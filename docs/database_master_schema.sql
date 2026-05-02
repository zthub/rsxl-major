-- ==========================================
-- RSXL-Major Master Database Schema
-- ==========================================
-- 说明：这是系统最完整的数据库架构文件，包含了所有表、函数、触发器及 RLS 安全策略。

-- 1. 基础扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 创建核心表
-- Profiles 表：存储用户扩展信息
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'patient' CHECK (role IN ('patient', 'trainer', 'admin')),
    subscription_type TEXT,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subscription Logs 表：存储续期流水
CREATE TABLE IF NOT EXISTS public.subscription_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0,
    previous_expiry TIMESTAMP WITH TIME ZONE,
    new_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    operator_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Training Sessions 表：存储训练数据
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    game_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    acuity_settings TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 安全与权限助手函数
-- 用于 RLS 的具有查看权限的判定函数 (admin + trainer)
CREATE OR REPLACE FUNCTION public.has_management_view()
RETURNS boolean AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('admin', 'trainer')
    OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', '') IN ('admin', 'trainer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 用于 RLS 的管理员判定函数 (仅 admin，用于增删改)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'admin'
    OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', '') = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 业务逻辑 RPC 函数
-- 管理员重置用户密码
CREATE OR REPLACE FUNCTION public.admin_rpc_reset_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_is_admin BOOLEAN;
BEGIN
    SELECT public.is_admin() INTO caller_is_admin;
    
    IF caller_is_admin IS NOT TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. 自动化触发器
-- 自动创建档案（当新用户注册时）
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.phone, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'patient')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. 安全策略 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "Profiles: Users can view their own, Managers can view all" 
ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_management_view());

CREATE POLICY "Profiles: Users can update their own, Admins can update all" 
ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles: Admins can insert/delete" 
ON public.profiles FOR ALL USING (public.is_admin());

-- Training Sessions 策略
CREATE POLICY "Training: Users can view their own, Managers can view all" 
ON public.training_sessions FOR SELECT USING (auth.uid() = user_id OR public.has_management_view());

CREATE POLICY "Training: Users can insert their own" 
ON public.training_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscription Logs 策略
CREATE POLICY "Logs: Users can view their own, Managers can view all" 
ON public.subscription_logs FOR SELECT USING (auth.uid() = user_id OR public.has_management_view());

CREATE POLICY "Logs: Admins can insert" 
ON public.subscription_logs FOR INSERT WITH CHECK (public.is_admin());

-- 7. 元数据同步工具 (用于修复存量数据)
-- 功能：将 Profiles 表中的角色同步到 Auth.users 的元数据中
CREATE OR REPLACE FUNCTION public.sync_all_users_metadata()
RETURNS void AS $$
BEGIN
  UPDATE auth.users u
  SET 
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role, 'email_verified', true),
    raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
  FROM public.profiles p
  WHERE u.id = p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 初始化执行项 (可选)
-- SELECT public.sync_all_users_metadata();
-- NOTIFY pgrst, 'reload schema';
