CREATE TABLE public.monthly_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month date NOT NULL,
  content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.monthly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own monthly_insights select" ON public.monthly_insights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own monthly_insights insert" ON public.monthly_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own monthly_insights update" ON public.monthly_insights
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own monthly_insights delete" ON public.monthly_insights
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_monthly_insights_user_month ON public.monthly_insights(user_id, month DESC);