import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/authContext';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2, Key, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
    const { session, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        console.log('--- Password Change Process Started (RPC Mode) ---');

        if (formData.newPassword !== formData.confirmPassword) {
            setMsg({ type: 'error', text: '两次输入的新密码不一致' });
            return;
        }

        if (formData.newPassword.length < 6) {
            setMsg({ type: 'error', text: '新密码长度至少为 6 位' });
            return;
        }

        setLoading(true);
        try {
            console.log('Calling database RPC to change password...');
            
            // Using RPC is much more stable than auth.updateUser in complex session environments
            const { data, error } = await supabase.rpc('user_rpc_change_password', {
                old_password: formData.oldPassword,
                new_password: formData.newPassword
            });

            if (error) {
                console.error('RPC Execution Error:', error);
                throw error;
            }

            if (data && data.success === false) {
                console.warn('RPC Logic Error:', data.error);
                throw new Error(data.error || '修改失败');
            }

            console.log('Password updated successfully via RPC.');
            setMsg({ type: 'success', text: '密码修改成功！系统将在 3 秒后自动注销，请使用新密码重新登录。' });
            
            // 3. Forced logout after delay
            setTimeout(async () => {
                console.log('Executing final logout...');
                await signOut();
                navigate('/auth');
            }, 3000);

        } catch (error: any) {
            console.error('Password change error caught:', error);
            setMsg({ type: 'error', text: error.message || '修改失败' });
        } finally {
            setLoading(false);
            console.log('--- Password Change Process Finished ---');
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <User className="w-8 h-8 text-brand-blue" /> 个人账户设置
                </h1>
                <p className="text-slate-500 mt-2">管理您的账户安全及个人信息</p>
            </div>

            <div className="grid gap-6">
                {/* Profile Info Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-500" /> 基本信息
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between py-3 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">账号/邮箱</span>
                            <span className="text-slate-800 font-medium">
                                {profile?.email?.endsWith('@rsxl.local') 
                                    ? profile.email.split('@')[0] 
                                    : (profile?.email || profile?.phone || '未知')}
                            </span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">用户姓名</span>
                            <span className="text-slate-800 font-medium">{profile?.full_name || '未填'}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">账户状态</span>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                                {profile?.role === 'admin' ? '系统管理员' : 
                                 profile?.role === 'trainer' ? '系统教练' : '普通用户'}
                            </span>
                        </div>
                        <div className="flex justify-between py-3">
                            <span className="text-slate-500 text-sm">账户有效期</span>
                            <span className="text-slate-800 font-medium">
                                {profile?.role === 'admin' || profile?.role === 'trainer' || (profile?.expired_at && new Date(profile.expired_at).getFullYear() > 9000)
                                    ? '永久有效'
                                    : (profile?.expired_at ? new Date(profile.expired_at).toLocaleDateString() : '无数据')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Lock className="w-32 h-32" />
                    </div>
                    
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Key className="w-5 h-5 text-orange-500" /> 修改登录密码
                    </h2>

                    {msg && (
                        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                            msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-medium">{msg.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">当前密码</label>
                            <input
                                type="password"
                                required
                                value={formData.oldPassword}
                                onChange={e => setFormData({ ...formData, oldPassword: e.target.value })}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                placeholder="请输入现有登录密码"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">新密码</label>
                            <input
                                type="password"
                                required
                                value={formData.newPassword}
                                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                placeholder="设置不少于 6 位的新密码"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">确认新密码</label>
                            <input
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                placeholder="请再次输入新密码"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 mt-4 bg-brand-blue text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    正在同步...
                                </>
                            ) : '确认修改密码'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
