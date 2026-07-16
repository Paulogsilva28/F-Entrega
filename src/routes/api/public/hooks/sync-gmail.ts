import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runGmailSyncForUser } from "@/server/gmail-sync.server";

export const Route = createFileRoute("/api/public/hooks/sync-gmail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const results: Array<{ userId: string; inserted: number; skipped: number; errors: number }> = [];

        try {
          let page = 1;
          const perPage = 200;
          while (true) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
            if (error) throw error;
            const users = data?.users ?? [];
            if (users.length === 0) break;

            for (const u of users) {
              try {
                const r = await runGmailSyncForUser(u.id);
                results.push({
                  userId: u.id,
                  inserted: r.inserted ?? 0,
                  skipped: r.skipped ?? 0,
                  errors: r.errors?.length ?? 0,
                });
              } catch (e: any) {
                console.error("[cron sync-gmail] user failed", u.id, e?.message);
                results.push({ userId: u.id, inserted: 0, skipped: 0, errors: 1 });
              }
            }

            if (users.length < perPage) break;
            page++;
          }

          const totals = results.reduce(
            (s, r) => ({
              inserted: s.inserted + r.inserted,
              skipped: s.skipped + r.skipped,
              errors: s.errors + r.errors,
            }),
            { inserted: 0, skipped: 0, errors: 0 },
          );

          return Response.json({
            success: true,
            users: results.length,
            totals,
            ranAt: new Date().toISOString(),
          });
        } catch (e: any) {
          console.error("[cron sync-gmail] fatal", e);
          return Response.json(
            { success: false, error: String(e?.message ?? e) },
            { status: 500 },
          );
        }
      },
    },
  },
});