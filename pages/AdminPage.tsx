import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../utils/supabase';
import { useAuth } from '../utils/authContext';
import {
    Search, UserPlus, Edit2, Key, Calendar,
    History, DollarSign, ChevronRight, User as UserIcon,
    AlertTriangle, CheckCircle2, X, Trash2, ChevronLeft, Activity
} from 'lucide-react';

interface Profile {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    role: string;
    subscription_type: string | null;
    expired_at: string | null;
    created_at: string;
}

interface RenewalLog {
    id: string;
    type: string;
    amount: number;
    previous_expiry: string | null;
    new_expiry: string;
    created_at: string;
}

export const AdminPage: React.FC = () => {
    const { profile: adminProfile } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [logs, setLogs] = useState<RenewalLog[]>([]);
    const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [localMsg, setLocalMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    // Form states
    const [formData, setFormData] = useState({
        accountType: 'email' as 'email' | 'phone',
        email: '',
        phone: '',
        full_name: '',
        password: '123456',
        subscription_type: '免费试用',
        duration_days: 3,
        role: 'patient' as 'patient' | 'trainer'
    });

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        setLoading(true);
        console.log('AdminPage: Fetching profiles...');
        try {
            // Add a 10s timeout to the database query
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            const timeoutPromise = new Promise<{data: any, error: any}>(resolve => 
                setTimeout(() => resolve({ data: null, error: { message: '请求超时，数据库响应变慢' } }), 10000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) {
                console.error('FetchProfiles Error:', error);
                setMsg({ type: 'error', text: '加载用户列表失败: ' + error.message });
            } else {
                setProfiles(data || []);
            }
        } catch (err: any) {
            console.error('FetchProfiles Exception:', err);
            setMsg({ type: 'error', text: '加载出现异常，请尝试手动刷新。' });
        } finally {
            setLoading(false);
        }
    };

    const handleForceRefresh = () => {
        window.location.reload();
    };

    const handleDeleteUser = async (userId: string, name: string) => {
        if (!window.confirm(`确定要彻底删除用户 "${name || '该用户'}" 吗？此操作将删除其所有相关数据且无法恢复！`)) {
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-operations', {
                body: { action: 'delete-user', user_id: userId }
            });

            if (error || (data && !data.success)) {
                // Determine the exact source of error (Invoke Error vs Biz Error)
                const errorMsg = error?.message || (data && data.error) || '未知网络错误';
                console.error('Delete User Failed Details:', { invokeError: error, bizData: data });
                
                // Even if failed, try to refresh once to see if user was partially deleted
                fetchProfiles();
                throw new Error(errorMsg);
            }

            setMsg({ type: 'success', text: '用户已成功删除' });
            fetchProfiles(); // Success path refresh
        } catch (err: any) {
            console.error('Delete error:', err);
            setMsg({ type: 'error', text: '删除用户失败: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (userId: string) => {
        const { data, error } = await supabase
            .from('subscription_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            setMsg({ type: 'error', text: '加载续期记录失败' });
        } else {
            setLogs(data || []);
        }
    };

    const fetchTrainingSessions = async (userId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('training_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false });

            if (error) throw error;
            setTrainingSessions(data || []);
        } catch (error: any) {
            console.error('Fetch training error:', error);
            setMsg({ type: 'error', text: '加载训练记录失败' });
        } finally {
            setLoading(false);
        }
    };

    const generateRandomPassword = () => {
        const pass = Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit number
        setFormData({ ...formData, password: pass });
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setLocalMsg(null);
        try {
            const identifier = formData.accountType === 'email' ? formData.email : `${formData.phone}@rsxl.local`;
            
            console.log('Creating user via Edge Function (GoTrue Admin API)...');

            // Call Edge Function to create user via GoTrue Admin API
            // This is the ONLY reliable way - direct SQL insert into auth.users doesn't work
            const { data, error } = await supabase.functions.invoke('admin-operations', {
                body: {
                    action: 'create-user',
                    email: identifier,
                    password: formData.password,
                    full_name: formData.full_name,
                    subscription_type: formData.subscription_type,
                    duration_days: formData.duration_days,
                    role: formData.role
                }
            });

            if (error) {
                console.error('Edge Function Error:', error);
                throw error;
            }

            if (data && data.success === false) {
                console.warn('Edge Function Biz Error:', data.error);
                throw new Error(data.error || '创建失败');
            }

            setLocalMsg({ type: 'success', text: `用户创建成功！账号: ${identifier.replace('@rsxl.local', '')}` });
            
            setTimeout(() => {
                setShowCreateModal(false);
                fetchProfiles();
            }, 1000);

        } catch (error: any) {
            console.error('Create User Process Error:', error);
            setLocalMsg({ type: 'error', text: '创建失败: ' + (error.message || '请确认 Edge Function 已部署') });
        } finally {
            setLoading(false);
        }
    };

    const handleRenewal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProfile) return;

        setLoading(true);
        try {
            // Calculate new expiry
            const baseDate = selectedProfile.expired_at && new Date(selectedProfile.expired_at) > new Date()
                ? new Date(selectedProfile.expired_at)
                : new Date();

            const newExpiry = new Date(baseDate);
            newExpiry.setDate(newExpiry.getDate() + formData.duration_days);

            // Atomic Update & Log via RPC
            const { data: rpcData, error: rpcError } = await supabase.rpc('admin_rpc_manage_subscription', {
                target_user_id: selectedProfile.id,
                log_type: '管理员续期',
                log_amount: 0,
                new_subscription_type: formData.subscription_type,
                new_expiry: newExpiry.toISOString(),
                prev_expiry: selectedProfile.expired_at
            });

            if (rpcError) throw rpcError;
            if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'RPC 执行失败');

            setMsg({ type: 'success', text: '续期成功并已记录流水' });
            setShowEditModal(false);
            fetchProfiles();
        } catch (error: any) {
            setMsg({ type: 'error', text: '续期失败: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedProfile) return;

        const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
        
        if (!window.confirm(`确定要为用户 ${selectedProfile.full_name} 重置密码吗？\n该操作将通过安全边缘函数执行。`)) {
            return;
        }

        setLoading(true);
        try {
            // Use SQL RPC instead of Edge Function to avoid deployment dependency
            const { data, error } = await supabase.rpc('admin_rpc_reset_password', {
                target_user_id: selectedProfile.id,
                new_password: newPassword
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error || '重置失败');

            setMsg({ 
                type: 'success', 
                text: `密码已成功重置！新密码为: ${newPassword}` 
            });
            setShowEditModal(false);
        } catch (error: any) {
            console.error('Reset password error:', error);
            setMsg({ type: 'error', text: '重置失败: ' + (error.message || '数据库函数执行异常') });
        } finally {
            setLoading(false);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredProfiles.length / pageSize);
    const paginatedProfiles = filteredProfiles.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // Reset page when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">管理中心</h1>
                    <p className="text-slate-500">
                        {adminProfile?.role === 'trainer' ? '教练模式：全量数据查阅权限' : '系统超级管理员权限已激活'}
                    </p>
                </div>
                {adminProfile?.role === 'admin' && (
                    <button
                        onClick={() => {
                            setFormData({ accountType: 'email', email: '', phone: '', full_name: '', password: '', subscription_type: '免费试用', duration_days: 3, role: 'patient' });
                            setShowCreateModal(true);
                        }}
                        className="bg-brand-blue text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        <UserPlus className="w-5 h-5" /> 新增用户
                    </button>
                )}
            </div>

            {/* Notifications */}
            {msg && (
                <div className={`p-4 rounded-2xl flex items-center justify-between ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <div className="flex items-center gap-2">
                        {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span className="font-medium">{msg.text}</span>
                    </div>
                    <button onClick={() => setMsg(null)}><X className="w-5 h-5" /></button>
                </div>
            )}


            {/* Search & Stats */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="搜索姓名或邮箱..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-blue transition-all"
                    />
                </div>
                <div className="hidden md:flex items-center gap-6 px-4">
                    <div className="text-center">
                        <div className="text-xl font-bold text-slate-800">{profiles.length}</div>
                        <div className="text-xs text-slate-400">总用户</div>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-green-600">
                            {profiles.filter(p => !p.expired_at || new Date(p.expired_at) > new Date()).length}
                        </div>
                        <div className="text-xs text-slate-400">活跃</div>
                    </div>
                </div>
            </div>

            {/* User Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">用户信息</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">有效期至</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-blue"></div>
                                            <div className="text-slate-400">正在加载用户列表...</div>
                                            <button 
                                                onClick={handleForceRefresh}
                                                className="text-xs text-brand-blue hover:underline"
                                            >
                                                加载过慢？点击刷新页面
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && paginatedProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                                        {searchTerm ? '暂无符合条件的用户' : '暂无用户数据'}
                                    </td>
                                </tr>
                            )}
                            {paginatedProfiles.map((p) => {
                                const isExpired = p.expired_at && new Date(p.expired_at) < new Date();
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                                    <UserIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{p.full_name || '未填写姓名'}</div>
                                                    <div className="text-sm text-slate-400">
                                                        {p.email?.replace('@rsxl.local', '')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                p.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                                                p.role === 'trainer' ? 'bg-amber-100 text-amber-700' : 
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                                {p.role === 'admin' ? '超管' : p.role === 'trainer' ? '教练' : (p.subscription_type || '患者')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                                                {p.role === 'trainer' || (p.expired_at && new Date(p.expired_at).getFullYear() > 9000) 
                                                    ? '永久有效' 
                                                    : (p.expired_at ? new Date(p.expired_at).toLocaleDateString() : '无数据')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                <span className={`text-sm ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
                                                    {isExpired ? '已过期' : '正常'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setSelectedProfile(p); fetchLogs(p.id); setShowLogsModal(true); }}
                                                    className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-xl transition-all"
                                                    title="查看记录"
                                                >
                                                    <History className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedProfile(p); fetchTrainingSessions(p.id); setShowTrainingModal(true); }}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                                    title="训练数据"
                                                >
                                                    <Activity className="w-5 h-5" />
                                                </button>
                                                
                                                {adminProfile?.role === 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                const newPass = window.prompt(`正在为用户 ${p.full_name || p.email} 输入新密码`, '123456');
                                                                if (!newPass) return;
                                                                setLoading(true);
                                                                try {
                                                                    const { data, error } = await supabase.rpc('admin_rpc_reset_password', {
                                                                        target_user_id: p.id,
                                                                        new_password: newPass
                                                                    });
                                                                    if (error || (data && !data.success)) throw new Error(error?.message || data?.error);
                                                                    setMsg({ type: 'success', text: '密码重置成功' });
                                                                } catch (err: any) {
                                                                    setMsg({ type: 'error', text: '重置失败: ' + err.message });
                                                                } finally {
                                                                    setLoading(false);
                                                                }
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                                                            title="重置密码"
                                                        >
                                                            <Key className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProfile(p);
                                                                setFormData({ ...formData, subscription_type: p.subscription_type || '一年会员', duration_days: 365 });
                                                                setShowEditModal(true);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
                                                            title="续期/编辑"
                                                        >
                                                            <Edit2 className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(p.id, p.full_name || p.email || p.phone || '')}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="删除用户"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                显示第 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredProfiles.length)} 条，
                                共 {filteredProfiles.length} 条数据
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
                                        // Simple pagination: show first, last, and around current
                                        if (
                                            page === 1 || 
                                            page === totalPages || 
                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                                                        currentPage === page 
                                                        ? 'bg-brand-blue text-white shadow-md' 
                                                        : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        } else if (
                                            page === currentPage - 2 || 
                                            page === currentPage + 2
                                        ) {
                                            return <span key={page} className="px-1 text-slate-400">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">新增用户</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                        </div>

                        {localMsg && (
                            <div className={`mb-4 p-3 rounded-xl text-sm border ${localMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                {localMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">账号类型</label>
                                <div className="flex gap-4 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.accountType === 'email'}
                                            onChange={() => setFormData({ ...formData, accountType: 'email' })}
                                            className="w-4 h-4 text-brand-blue"
                                        />
                                        <span className="text-sm text-slate-600">邮箱</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.accountType === 'phone'}
                                            onChange={() => setFormData({ ...formData, accountType: 'phone' })}
                                            className="w-4 h-4 text-brand-blue"
                                        />
                                        <span className="text-sm text-slate-600">手机号</span>
                                    </label>
                                </div>

                                {formData.accountType === 'email' ? (
                                    <>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">电子邮箱</label>
                                        <input
                                            type="email" required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">手机号</label>
                                        <input
                                            type="tel" required
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
                                            placeholder="如: 13800138000"
                                        />
                                    </>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">姓名</label>
                                <input
                                    type="text" required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">初始密码</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-blue outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={generateRandomPassword}
                                        className="whitespace-nowrap px-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        随机生成
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">用户角色</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                    >
                                        <option value="patient">普通患者</option>
                                        <option value="trainer">教练 (永久有效)</option>
                                    </select>
                                </div>
                                {formData.role === 'patient' ? (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">默认套餐</label>
                                        <select
                                            value={formData.subscription_type}
                                            onChange={e => setFormData({ ...formData, subscription_type: e.target.value })}
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                        >
                                            <option>免费试用</option>
                                            <option>一年会员</option>
                                            <option>终身会员</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-sm text-amber-600 font-bold bg-amber-50 p-2 rounded-xl border border-amber-100">
                                        教练账号无有效期限制
                                    </div>
                                )}
                            </div>
                            {formData.role === 'patient' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">有效时长 (天)</label>
                                    <input
                                        type="number"
                                        value={formData.duration_days}
                                        onChange={e => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                    />
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-6 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg"
                            >
                                {loading ? '执行中...' : '提交创建'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit / Renewal Modal */}
            {showEditModal && selectedProfile && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">账户续期</h2>
                                <p className="text-sm text-slate-500">为 {selectedProfile.full_name} 延长有效期</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                        </div>
                        <form onSubmit={handleRenewal} className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-orange-800">
                                    当前到期时间: {selectedProfile.expired_at ? new Date(selectedProfile.expired_at).toLocaleString() : '永久'}
                                    <br />
                                    续期后将在当前或现在的基础上增加天数。
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">续期套餐</label>
                                    <select
                                        value={formData.subscription_type}
                                        onChange={e => setFormData({ ...formData, subscription_type: e.target.value })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                    >
                                        <option>一年会员</option>
                                        <option>半年会员</option>
                                        <option>免费试用</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">增加天数</label>
                                    <input
                                        type="number"
                                        value={formData.duration_days}
                                        onChange={e => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={handleResetPassword}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Key className="w-5 h-5" /> 重置密码
                                    </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 bg-brand-blue text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <DollarSign className="w-5 h-5" /> 确认续期
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Logs Modal */}
            {showLogsModal && selectedProfile && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">续期流水</h2>
                                <p className="text-sm text-slate-500">{selectedProfile.full_name} ({selectedProfile.email || selectedProfile.phone})</p>
                            </div>
                            <button onClick={() => setShowLogsModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                            {logs.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">暂无续期记录</div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-slate-800">{log.type}</div>
                                            <div className="text-xs text-slate-400">操作时间: {new Date(log.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium text-green-600">
                                                新有效期: {new Date(log.new_expiry).toLocaleDateString()}
                                            </div>
                                            {log.previous_expiry && (
                                                <div className="text-xs text-slate-400">
                                                    原有效期: {new Date(log.previous_expiry).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Training Sessions Modal */}
            {showTrainingModal && selectedProfile && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">训练记录总览</h2>
                                    <p className="text-sm text-slate-500">{selectedProfile.full_name} 的历史训练数据</p>
                                </div>
                            </div>
                            <button onClick={() => setShowTrainingModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {trainingSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                                    <Activity className="w-12 h-12 opacity-20" />
                                    <p>该用户暂无任何训练数据</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {trainingSessions.map(session => (
                                        <div key={session.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all hover:shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-tight">
                                                    {session.game_id}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {new Date(session.completed_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-between">
                                                <div className="space-y-1">
                                                    <div className="text-sm text-slate-500">训练得分</div>
                                                    <div className="text-3xl font-black text-emerald-600 leading-none">
                                                        {session.score}<span className="text-sm ml-1 font-bold">分</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm text-slate-500 mb-1">训练时长</div>
                                                    <div className="inline-flex items-center px-2 py-1 bg-slate-200/50 rounded-lg text-sm font-bold text-slate-700">
                                                        {Math.floor(session.duration_seconds / 60)}分{session.duration_seconds % 60}秒
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
