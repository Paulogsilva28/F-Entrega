import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncPluggyExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
    const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
    const PLUGGY_ACCOUNT_ID = process.env.PLUGGY_ACCOUNT_ID;

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET || !PLUGGY_ACCOUNT_ID) {
      throw new Error("Missing Pluggy environment variables: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ACCOUNT_ID");
    }

    // 1. Autenticar na API da Pluggy para obter a apiKey
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Pluggy authentication failed: ${errText}`);
    }

    const { apiKey } = await authRes.json();

    // 2. Buscar as transações na conta da Pluggy
    const txRes = await fetch(`https://api.pluggy.ai/transactions?accountId=${PLUGGY_ACCOUNT_ID}&pageSize=100`, {
      headers: { "X-API-KEY": apiKey },
    });

    if (!txRes.ok) {
      const errText = await txRes.text();
      throw new Error(`Failed to fetch Pluggy transactions: ${errText}`);
    }

    const { results: transactions } = await txRes.json();

    // 3. Buscar as regras de matching do banco (tabela estabelecimentos_moto)
    const { data: rules, error: rulesError } = await supabase
      .from("estabelecimentos_moto")
      .select("nome, tipo");

    if (rulesError) {
      throw new Error(`Failed to fetch matching rules: ${rulesError.message}`);
    }

    const rulesList = (rules ?? []).map((r: { nome: string; tipo: string }) => ({
      nome: r.nome.toUpperCase(),
      tipo: r.tipo,
    }));

    // 4. Executar matching e registrar os gastos da moto no Supabase
    let inserted = 0;
    let skipped = 0;

    for (const tx of (transactions ?? [])) {
      const rawAmount = Number(tx.amount);
      
      // Ignorar entradas (créditos). Na Pluggy os gastos vêm como valores negativos.
      if (rawAmount >= 0) continue;

      const amount = Math.abs(rawAmount);
      const description = (tx.description ?? "").toUpperCase();
      const date = (tx.date ?? "").slice(0, 10); // Formato YYYY-MM-DD

      // Verificar se a transação corresponde a algum posto/oficina cadastrado
      const match = rulesList.find((r) => description.includes(r.nome));

      if (match) {
        const { error: insertError } = await supabase
          .from("moto_expenses")
          .insert({
            user_id: userId,
            description: `${match.nome} (${tx.description})`,
            amount,
            expense_date: date,
            pluggy_transaction_id: tx.id,
            is_archived: false,
          });

        if (insertError) {
          // Se for código 23505 (unique_violation) no Postgres, significa que a transação já foi importada
          if (insertError.code === "23505") {
            skipped++;
          } else {
            console.error(`Failed to insert expense ${tx.id}:`, insertError.message);
          }
        } else {
          inserted++;
        }
      }
    }

    return { inserted, skipped };
  });
