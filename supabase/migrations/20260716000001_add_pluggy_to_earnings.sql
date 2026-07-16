ALTER TABLE public.uber_withdrawals 
ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;

ALTER TABLE public.food_withdrawals 
ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;
