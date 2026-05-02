import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
    const { session, profile, isLoading } = useAuth();
    const location = useLocation();

    // 1. Initial Auth Check (JWT verification)
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    // 2. Deny access if no session exists at all
    if (!session) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // 3. Special handling for Admin: If session exists, WAITING for profile is mandatory.
    // We don't want to redirect until we are CERTAIN about the role.
    if (requireAdmin && !profile) {
        console.log('ProtectedRoute: Session valid, waiting for admin profile...');
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
                    <p className="text-slate-500 text-sm">正在验证管理员身份...</p>
                </div>
            </div>
        );
    }

    // 4. Fallback for non-admin pages where profile is missing
    if (!profile) {
        return <Navigate to="/" replace />;
    }

    // 5. Final Permission Check
    const hasAccess = requireAdmin 
        ? (profile.role === 'admin' || profile.role === 'trainer')
        : true;

    if (!hasAccess) {
        console.warn('ProtectedRoute: Permission Denied. User role:', profile.role);
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
