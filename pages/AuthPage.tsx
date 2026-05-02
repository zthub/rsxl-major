import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/authContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, LogIn, RefreshCw, AlertCircle } from 'lucide-react';

export const AuthPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showHardReset, setShowHardReset] = useState(false);

    const { session } = useAuth();
    const navigate = useNavigate();

    // If a reset is requested via URL or the page is stuck, we can use this
    useEffect(() => {
        if (searchParams.get('reset') === 'true') {
            handleHardReset();
        }
    }, [searchParams]);

    const handleHardReset = () => {
        console.log('Performing hard reset of auth state...');
        localStorage.clear();
        // Clear specific supabase keys if clear() is too aggressive
        // But for a "fix it all" button, clear() is safest
        window.location.href = window.location.pathname; // Reload without query params
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setShowHardReset(false);

        try {
            const identifier = email.includes('@') ? email : `${email}@rsxl.local`;

            // Add a timeout to the login request to prevent perpetual hanging
            const loginPromise = supabase.auth.signInWithPassword({
                email: identifier,
                password: password
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), 10000)
            );

            const { error } = await Promise.race([loginPromise, timeoutPromise]) as any;
            
            if (error) throw error;
            navigate('/');
        } catch (error: any) {
            console.error('Auth error:', error);
            if (error.message === 'LOGIN_TIMEOUT') {
                setErrorMsg('登录请求超时。这通常是由于浏览器缓存冲突引起的。');
                setShowHardReset(true);
            } else {
                setErrorMsg(error.message || '发生未知错误');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center relative z-10">
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl w-full max-w-md border border-white/40">
                <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
                    欢迎回来
                </h2>

                {errorMsg && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-lg text-sm">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">

                    <div>
                        <label className="block text-gray-700 text-xs font-bold mb-1 ml-1">账号 (邮箱或手机号)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                placeholder="请输入账号"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-700 text-xs font-bold mb-1 ml-1">密码</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                placeholder="请输入密码"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? '处理中...' : <><LogIn className="w-4 h-4" /> 立即登录</>}
                    </button>

                    {showHardReset && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-start gap-3 mb-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    检测到环境异常导致登录挂起。点击下方按钮将强制清理浏览器缓存的会话并刷新，这通常能解决 99% 的卡顿问题。
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleHardReset}
                                className="w-full py-2 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <RefreshCw className="w-3 h-3" /> 强制重置并刷新环境
                            </button>
                        </div>
                    )}
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500">账号由管理员统一分配</p>
                    <p className="text-[10px] text-gray-300 mt-2">v1.2.1 Stable Auth System</p>
                </div>
            </div>
        </div>
    );
};
