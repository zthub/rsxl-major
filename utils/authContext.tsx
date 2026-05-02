import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: 'patient' | 'trainer' | 'admin';
    subscription_type: string | null;
    expired_at: string | null;
    phone: string | null;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    isExpired: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpired, setIsExpired] = useState(false);

    const fetchProfile = async (userId: string): Promise<Profile | null> => {
        // Add 8-second timeout to prevent hanging forever
        const fetchPromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.warn('fetchProfile error:', error.message);
                    return null;
                }
                return data as Profile;
            });

        const timeoutPromise = new Promise<null>(resolve =>
            setTimeout(() => {
                console.warn('fetchProfile timed out after 8s');
                resolve(null);
            }, 8000)
        );

        return Promise.race([fetchPromise, timeoutPromise]);
    };

    const getProfileFromAuth = async (session: any): Promise<Profile | null> => {
        // Try identity claims (fastest, no network call)
        // Check BOTH app_metadata (common for roles) and user_metadata
        const user = session.user;
        const metaRole = (user.app_metadata?.role || user.user_metadata?.role) as 'patient' | 'trainer' | 'admin' | undefined;
        
        if (metaRole) {
            return {
                id: user.id,
                email: user.email ?? null,
                full_name: (user.user_metadata?.full_name || user.app_metadata?.full_name) ?? null,
                role: metaRole,
                subscription_type: null,
                expired_at: null,
                phone: null
            };
        }

        // Fallback: call GoTrue directly to get fresh user data
        // (This avoids PostgREST which may be slow/broken)
        try {
            const { data: { user: freshUser } } = await supabase.auth.getUser();
            const freshRole = (freshUser?.app_metadata?.role || freshUser?.user_metadata?.role) as 'patient' | 'trainer' | 'admin' | undefined;
            if (freshRole && freshUser) {
                return {
                    id: freshUser.id,
                    email: freshUser.email ?? null,
                    full_name: (freshUser.user_metadata?.full_name || freshUser.app_metadata?.full_name) ?? null,
                    role: freshRole,
                    subscription_type: null,
                    expired_at: null,
                    phone: null
                };
            }
        } catch (e) {
            console.warn('getUser fallback failed:', e);
        }

        return null;
    };

    const checkExpiration = (profileData: Profile | null) => {
        if (!profileData || !profileData.expired_at) return false;
        // Admins and Trainers never expire
        if (profileData.role === 'admin' || profileData.role === 'trainer') return false;
        const expiryDate = new Date(profileData.expired_at);
        const now = new Date();
        return expiryDate < now;
    };

    useEffect(() => {
        let isMounted = true;

        const authTimeout = setTimeout(() => {
            if (isLoading && isMounted) {
                console.warn('Auth initialization timed out after 15s');
                setIsLoading(false);
            }
        }, 15000);

        const initializeAuth = async () => {
            const initStartTime = Date.now();
            console.log('AuthContext: Initializing...');
            
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                console.log(`AuthContext: getSession took ${Date.now() - initStartTime}ms`);
                
                if (error) throw error;
                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Step 1: Get role from JWT or GoTrue
                    const authStepStart = Date.now();
                    const authProfile = await getProfileFromAuth(session);
                    console.log(`AuthContext: getProfileFromAuth took ${Date.now() - authStepStart}ms`);
                    
                    if (authProfile && isMounted) {
                        setProfile(authProfile);
                        setIsLoading(false);
                        clearTimeout(authTimeout);
                    }

                    // Step 2: In background, fetch real profile
                    const dbStepStart = Date.now();
                    const profileData = await fetchProfile(session.user.id);
                    console.log(`AuthContext: fetchProfile (DB) took ${Date.now() - dbStepStart}ms`);
                    
                    if (isMounted) {
                        if (profileData) {
                            setProfile(profileData);
                            setIsExpired(checkExpiration(profileData));
                        }
                        setIsLoading(false);
                        clearTimeout(authTimeout);
                    }
                } else {
                    setProfile(null);
                    setIsExpired(false);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    clearTimeout(authTimeout);
                    console.log(`AuthContext: Total initialization time: ${Date.now() - initStartTime}ms`);
                }
            }
        };

        initializeAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            console.log(`Auth state change: ${event}`);
            
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setIsLoading(false); // Make sure loading stops on sign out
                setIsExpired(false);
                return;
            }

            if (event === 'TOKEN_REFRESHED') {
                setSession(session);
                setUser(session?.user ?? null);
                return;
            }

            if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
                setSession(session);
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    // CRITICAL: Try to get role from metadata IMMEDIATELY
                    const authProfile = await getProfileFromAuth(session);
                    if (authProfile && isMounted) {
                        setProfile(prev => prev || authProfile); // Only set if not already set
                        setIsLoading(false);
                        clearTimeout(authTimeout);
                    }

                    // Background: Update with full profile
                    fetchProfile(session.user.id).then(profileData => {
                        if (isMounted && profileData) {
                            setProfile(profileData);
                            setIsExpired(checkExpiration(profileData));
                            setIsLoading(false);
                            clearTimeout(authTimeout);
                        }
                    });
                } else {
                    setIsLoading(false); // Stop loading if no user
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(authTimeout);
        };
    }, []);


    const signOut = async () => {
        // 1. Manually clear state IMMEDIATELY to ensure UI responsiveness
        // This prevents the UI from hanging if the network request for signOut is slow or fails
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsExpired(false);
        setIsLoading(false);

        // 2. Clear localStorage manually just in case Supabase client is stuck
        try {
            const url = (import.meta as any).env?.VITE_SUPABASE_URL || '';
            const projectRef = url.split('//')[1]?.split('.')[0];
            const keysToRemove = [
                'supabase.auth.token',
                'sb-' + projectRef + '-auth-token'
            ];
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.warn('Error clearing localStorage:', e);
        }

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('SignOut error during remote call:', error);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            const profileData = await fetchProfile(user.id);
            setProfile(profileData);
            setIsExpired(checkExpiration(profileData));
        }
    };

    const value = {
        session,
        user,
        profile,
        isLoading,
        isExpired,
        signOut,
        refreshProfile
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
