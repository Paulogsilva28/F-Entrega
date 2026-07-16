CREATE TABLE IF NOT EXISTS public.pluggy_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    log_type TEXT,
    message TEXT,
    payload JSONB
);

ALTER TABLE public.pluggy_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own logs" ON public.pluggy_sync_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own logs" ON public.pluggy_sync_logs
    FOR SELECT USING (auth.uid() = user_id);
