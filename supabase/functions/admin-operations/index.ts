import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  // 1. Handle Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } })
  }

  try {
    // 2. Late Initialization
    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = Deno.env.get('ADMIN_MASTER_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!url || !key) {
      return new Response(
        JSON.stringify({ success: false, error: '边缘函数配置缺失: ADMIN_MASTER_KEY 未设置' }),
        { headers: corsHeaders, status: 200 }
      );
    }

    const supabaseAdmin = createClient(url, key, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    // 3. Parse Request
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      return new Response(JSON.stringify({ success: true, message: 'Admin API is Online' }), { headers: corsHeaders, status: 200 });
    }
    
    const body = JSON.parse(bodyText);
    const { action, email, password, full_name, subscription_type, duration_days, role = 'patient', user_id } = body;

    // 4. Action Handlers
    if (action === 'create-user') {
      const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, email_verified: true }
      });

      if (authError) {
        return new Response(JSON.stringify({ success: false, error: authError.message }), { headers: corsHeaders, status: 200 });
      }

      const expiry = new Date();
      if (role === 'trainer') {
        expiry.setFullYear(9999);
      } else {
        expiry.setDate(expiry.getDate() + (Number(duration_days) || 3));
      }

      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name,
        role,
        subscription_type: role === 'trainer' ? '永久教练' : subscription_type,
        expired_at: expiry.toISOString()
      });

      return new Response(JSON.stringify({ success: true, user_id: data.user.id }), { headers: corsHeaders, status: 200 });
    }

    if (action === 'delete-user') {
      if (!user_id) {
        return new Response(JSON.stringify({ success: false, error: '缺失 user_id' }), { headers: corsHeaders, status: 200 });
      }

      // Step A: Delete from Auth
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) {
        return new Response(JSON.stringify({ success: false, error: `Auth删除失败: ${delError.message}` }), { headers: corsHeaders, status: 200 });
      }

      // Step B: Explicitly delete from profiles
      await supabaseAdmin.from('profiles').delete().eq('id', user_id);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown Action' }), { headers: corsHeaders, status: 200 });

  } catch (err) {
    console.error('Fatal Edge Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: `系统异常: ${err.message}` }),
      { headers: corsHeaders, status: 200 }
    );
  }
});
