import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runGmailSyncForUser } from "@/server/gmail-sync.server";

export const listFoodWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { since: string; until?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let query = supabase
      .from("food_withdrawals")
      .select("id, amount, withdrawal_date")
      .eq("user_id", userId)
      .gte("withdrawal_date", data.since);

    if (data.until) {
      query = query.lte("withdrawal_date", data.until);
    }

    const { data: rows, error } = await query.order("withdrawal_date", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return rows ?? [];
  });

export const syncFoodWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return await runGmailSyncForUser(supabase, userId);
  });
