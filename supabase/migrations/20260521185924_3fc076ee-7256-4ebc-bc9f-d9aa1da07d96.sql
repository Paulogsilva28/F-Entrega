CREATE TABLE public.uber_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  withdrawal_date TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.uber_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own uber_withdrawals select" ON public.uber_withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own uber_withdrawals insert" ON public.uber_withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own uber_withdrawals update" ON public.uber_withdrawals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own uber_withdrawals delete" ON public.uber_withdrawals FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_uber_withdrawals_user_date ON public.uber_withdrawals (user_id, withdrawal_date DESC);