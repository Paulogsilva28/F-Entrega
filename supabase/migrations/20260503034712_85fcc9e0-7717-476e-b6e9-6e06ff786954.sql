CREATE OR REPLACE FUNCTION public.close_moto_month()
RETURNS TABLE(archived_count integer, closed_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH updated AS (
    UPDATE public.moto_expenses
       SET is_archived = true,
           closed_at = v_now
     WHERE user_id = v_uid
       AND is_archived = false
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM updated;

  RETURN QUERY SELECT v_count, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.close_moto_month() FROM public;
GRANT EXECUTE ON FUNCTION public.close_moto_month() TO authenticated;