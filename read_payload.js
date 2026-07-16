import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://gxzrpklciqacxstdxwys.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enJwa2xjaXFhY3hzdGR4d3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjExODMsImV4cCI6MjA5MzIzNzE4M30.gUoglPXH1vBcwTFtSQvEiArUtpH2eM45AqrJ4IfFXUc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('pluggy_sync_logs')
    .select('payload')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  if (data && data.length > 0) {
    fs.writeFileSync('scratch_log_payload.json', JSON.stringify(data[0].payload, null, 2));
    console.log('Successfully wrote payload to scratch_log_payload.json');
  } else {
    console.log('No logs found.');
  }
}

main();
