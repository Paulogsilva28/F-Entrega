
CREATE TABLE public.moto_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.food_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  withdrawal_date TIMESTAMPTZ NOT NULL,
  raw_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

CREATE INDEX idx_moto_expenses_user_date ON public.moto_expenses(user_id, expense_date DESC);
CREATE INDEX idx_food_withdrawals_user_date ON public.food_withdrawals(user_id, withdrawal_date DESC);

ALTER TABLE public.moto_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own moto_expenses select" ON public.moto_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own moto_expenses insert" ON public.moto_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own moto_expenses update" ON public.moto_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own moto_expenses delete" ON public.moto_expenses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own food_withdrawals select" ON public.food_withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own food_withdrawals insert" ON public.food_withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own food_withdrawals update" ON public.food_withdrawals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own food_withdrawals delete" ON public.food_withdrawals FOR DELETE USING (auth.uid() = user_id);
