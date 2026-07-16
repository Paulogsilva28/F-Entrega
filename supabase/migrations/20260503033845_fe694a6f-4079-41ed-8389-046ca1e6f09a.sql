ALTER TABLE public.moto_expenses
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_moto_expenses_user_archived
  ON public.moto_expenses (user_id, is_archived);