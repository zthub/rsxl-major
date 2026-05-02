import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://efzizhzyruiqxonmwywc.supabase.co';
const ANON_KEY = 'sb_publishable_LdiuGU1lBU-8TN9UXkN3Cw_53Xg11MW';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testPing() {
  console.log('--- Edge Function Diagnostics ---');
  console.log('URL:', SUPABASE_URL);
  
  try {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'ping' }
    });

    if (error) {
      console.error('❌ Cloud Error:', error.message);
      if (error.context) {
          try {
            const body = await error.context.text();
            console.error('Response Body:', body);
          } catch (e) {
            console.error('Could not read error context body');
          }
      }
    } else {
      console.log('✅ Success Response:', data);
    }
  } catch (e) {
    console.error('❌ Exception:', e);
  }
}

testPing();
