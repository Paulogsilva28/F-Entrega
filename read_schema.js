import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gxzrpklciqacxstdxwys.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enJwa2xjaXFhY3hzdGR4d3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjExODMsImV4cCI6MjA5MzIzNzE4M30.gUoglPXH1vBcwTFtSQvEiArUtpH2eM45AqrJ4IfFXUc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: d1, error: e1 } = await supabase
    .from('food_withdrawals')
    .select('pluggy_transaction_id')
    .limit(1);

  console.log('food_withdrawals pluggy_transaction_id select error:', e1);

  const { data: d2, error: e2 } = await supabase
    .from('uber_withdrawals')
    .select('pluggy_transaction_id')
    .limit(1);

  console.log('uber_withdrawals pluggy_transaction_id select error:', e2);
}

main();
