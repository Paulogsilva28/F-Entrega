import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const SYNC_LOOKBACK_DAYS = 180;
const SYNC_MAX_RESULTS = 120;
const SYNC_CONCURRENCY = 8;

function decodeBase64Url(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    try {
      return decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      );
    } catch {
      return atob(base64);
    }
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractText(payload: any): string {
  if (!payload) return "";
  let out = "";
  if (payload.body?.data) {
    try {
      out += decodeBase64Url(payload.body.data) + "\n";
    } catch {}
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      out += extractText(part);
    }
  }
  return out;
}

function normalizeText(text: string): string {
  return text.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseAmount(text: string): number | null {
  const re = /R\$\s*([\d\.]+,\d{2})/i;
  const m = text.match(re);
  if (!m) return null;
  const normalized = m[1].replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

function buildWithdrawalQuery() {
  return encodeURIComponent(
    `((from:noreply@99app.com subject:"Seu Pix foi realizado com sucesso") OR ((from:noreply@99app.com OR from:99food@food.99app.com OR from:motorista@mkt.99app.com) (pix OR saque OR repasse OR retirada OR 99pay OR 99food))) newer_than:${SYNC_LOOKBACK_DAYS}d`,
  );
}

async function gmailFetch(path: string): Promise<any> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function runGmailSyncForUser(userId: string) {
  const supabase = supabaseAdmin;
  try {
    const query = buildWithdrawalQuery();
    const list = await gmailFetch(`/users/me/messages?q=${query}&maxResults=${SYNC_MAX_RESULTS}`);
    const messages: Array<{ id: string }> = list.messages ?? [];
    console.log(`[gmail-sync] query matched ${messages.length} messages`);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const samples: Array<{
      from: string;
      subject: string;
      hasSaque: boolean;
      hasFood: boolean;
      hasPixSuccess: boolean;
      amount: number | null;
    }> = [];

    const messageIds = messages.map((message) => message.id);
    const existingIds = new Set<string>();

    if (messageIds.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from("food_withdrawals")
        .select("gmail_message_id")
        .eq("user_id", userId)
        .in("gmail_message_id", messageIds);

      if (existingError) {
        throw new Error(`Failed to load cached withdrawals: ${existingError.message}`);
      }

      for (const row of existingRows ?? []) {
        if (row.gmail_message_id) existingIds.add(row.gmail_message_id);
      }
    }

    const pending = messages.filter((message) => !existingIds.has(message.id));
    skipped += messages.length - pending.length;

    let index = 0;
    const worker = async () => {
      while (index < pending.length) {
        const current = pending[index++];

        try {
          const msg = await gmailFetch(`/users/me/messages/${current.id}?format=full`);
          const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
          const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
          const from = headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
          const dateHeader = headers.find((h) => h.name.toLowerCase() === "date")?.value;
          const snippet = msg.snippet ?? "";

          const body = normalizeText(extractText(msg.payload));
          const haystack = `${subject}\n${from}\n${snippet}\n${body}`.toLowerCase();

          const hasSaque = /saque|repasse|retirada/.test(haystack);
          const hasFood = /99\s*food/.test(haystack);
          const hasPixSuccess = /seu pix foi realizado com sucesso|pix no valor de r\$|veja os dados da transaç[aã]o|método de pagamento/i.test(
            haystack,
          );
          const amount = parseAmount(snippet) ?? parseAmount(body) ?? parseAmount(subject);

          if (samples.length < 10) {
            samples.push({ from, subject, hasSaque, hasFood, hasPixSuccess, amount });
          }

          const senderIs99 = /99app\.com|99\s*pay|99\s*food|conta com a 99/i.test(from);
          const looksLikeWithdrawal =
            senderIs99 &&
            (hasSaque || hasFood || hasPixSuccess || /seu pix foi realizado com sucesso/i.test(subject));

          if (!looksLikeWithdrawal || amount == null) {
            skipped++;
            continue;
          }

          const date = dateHeader
            ? new Date(dateHeader)
            : new Date(Number(msg.internalDate ?? Date.now()));

          const { error: insErr } = await supabase.from("food_withdrawals").insert({
            user_id: userId,
            gmail_message_id: current.id,
            amount,
            withdrawal_date: date.toISOString(),
            raw_subject: subject.slice(0, 500),
          });

          if (insErr) {
            errors.push(`${current.id}: ${insErr.message}`);
            continue;
          }

          inserted++;
        } catch (e: any) {
          errors.push(`${current.id}: ${e.message ?? "unknown"}`);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(SYNC_CONCURRENCY, Math.max(pending.length, 1)) }, () => worker()),
    );

    return {
      scanned: messages.length,
      inserted,
      skipped,
      errors: errors.slice(0, 5),
      samples,
    };
  } catch (e: any) {
    console.error("[gmail-sync] fatal error", e);
    return {
      scanned: 0,
      inserted: 0,
      skipped: 0,
      errors: [String(e?.message ?? e)],
      samples: [],
      fatal: true,
    };
  }
}