import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gxzrpklciqacxstdxwys.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enJwa2xjaXFhY3hzdGR4d3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjExODMsImV4cCI6MjA5MzIzNzE4M30.gUoglPXH1vBcwTFtSQvEiArUtpH2eM45AqrJ4IfFXUc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('food_withdrawals')
    .select('*')
    .order('withdrawal_date', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Food Withdrawals count:', data.length);
  console.log('Latest 5 withdrawals:', JSON.stringify(data.slice(0, 5), null, 2));
}

main();
