import React from 'react';
import { Home, Settings, User, LogOut, LogIn, ShieldAlert, Clock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/authContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut, profile, isExpired } = useAuth();

  const isHome = location.pathname === '/';
  const isGamePage = location.pathname.includes('/game/');
  const isAuthPage = location.pathname === '/auth';
  const isAdminPage = location.pathname === '/admin';

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/auth');
    }
  };

  const hasAdminAccess = profile?.role === 'admin' || profile?.role === 'trainer' || 
                        session?.user?.user_metadata?.role === 'admin' || session?.user?.user_metadata?.role === 'trainer';
  const displayName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || '用户';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className={`mx-auto px-4 py-3 flex justify-between items-center ${isGamePage ? 'w-full' : 'max-w-5xl'}`}>
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-tr from-brand-blue to-brand-purple rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md">
              瞳
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">瞳趣</h1>
              <p className="text-xs text-slate-500 font-medium">儿童弱视训练系统</p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            {!isHome && !isGamePage && (
              <Link to="/" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors" title="返回首页">
                <Home className="w-6 h-6 text-slate-600" />
              </Link>
            )}

            {!isAuthPage && (
              <>
                {session ? (
                  <div className="flex items-center gap-3">
                    {hasAdminAccess && (
                      <Link
                        to="/admin"
                        className={`p-2 rounded-full transition-colors flex items-center justify-center ${isAdminPage ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        title={profile?.role === 'admin' ? "管理员控制台" : "教练管理中心"}
                      >
                        <ShieldAlert className="w-6 h-6" />
                      </Link>
                    )}
                    <span className="text-sm text-slate-600 hidden md:block border bg-slate-50 px-3 py-1 rounded-full">
                      {displayName} {
                        profile?.role === 'admin' ? '(管理员)' : 
                        profile?.role === 'trainer' ? '(教练)' : 
                        (profile?.subscription_type && `(${profile.subscription_type})`)
                      }
                    </span>
                    <button
                      onClick={handleLogout}
                      className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors flex items-center justify-center"
                      title="注销登录"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <Link to="/auth" className="px-4 py-2 bg-brand-blue text-white rounded-full hover:bg-blue-600 transition-colors text-sm font-bold flex items-center gap-2">
                    <LogIn className="w-4 h-4" /> 登录
                  </Link>
                )}
              </>
            )}

            <Link 
              to="/profile"
              className={`p-2 rounded-full transition-colors hidden md:block ${location.pathname === '/profile' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="账户设置"
            >
              <Settings className="w-6 h-6" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-grow w-full relative ${isGamePage ? 'p-0 overflow-hidden' : 'max-w-5xl mx-auto p-4 md:p-6'}`}>
        {children}

        {/* Account Expired Overlay */}
        {isExpired && !isAuthPage && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border-t-8 border-orange-500 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">账户已过期</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                您的训练套餐已到期或未激活。为了继续进行视力训练，请联系系统管理员进行续费。
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <LogOut className="w-5 h-5" /> 退出当前账号
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      {!isGamePage && (
        <footer className="bg-white border-t border-slate-100 py-6 mt-8">
          <div className="max-w-5xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>© 2024 瞳趣. 坚持训练，重获清晰视界。</p>
          </div>
        </footer>
      )}
    </div>
  );
};
