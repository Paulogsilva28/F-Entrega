import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://gxzrpklciqacxstdxwys.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enJwa2xjaXFhY3hzdGR4d3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjExODMsImV4cCI6MjA5MzIzNzE4M30.gUoglPXH1vBcwTFtSQvEiArUtpH2eM45AqrJ4IfFXUc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('pluggy_sync_logs')
    .select('id, created_at, log_type, message, payload')
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('Total logs fetched:', data.length);
  data.forEach((r, idx) => {
    console.log(`[${idx}] Date: ${r.created_at} | Type: ${r.log_type} | Msg: ${r.message}`);
  });

  fs.writeFileSync('scratch_all_logs.json', JSON.stringify(data, null, 2));
}

main();
