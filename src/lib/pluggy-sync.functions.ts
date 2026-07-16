import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncPluggyExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
    const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
    const PLUGGY_ITEM_ID = process.env.PLUGGY_ITEM_ID; // ID da conexão (Ex: obtido na URL do meu.pluggy.ai)
    const PLUGGY_ACCOUNT_ID = process.env.PLUGGY_ACCOUNT_ID; // ID da conta (opcional se tiver o ITEM_ID)

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      throw new Error("Missing Pluggy environment variables: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET");
    }

    if (!PLUGGY_ITEM_ID && !PLUGGY_ACCOUNT_ID) {
      throw new Error("Você precisa configurar pelo menos o PLUGGY_ITEM_ID ou PLUGGY_ACCOUNT_ID no seu painel da Cloudflare.");
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

    // 2. Determinar as contas (Account IDs) a serem sincronizadas
    const accountIds: string[] = [];

    if (PLUGGY_ACCOUNT_ID) {
      accountIds.push(PLUGGY_ACCOUNT_ID);
    } else if (PLUGGY_ITEM_ID) {
      // Se tivermos o ITEM_ID, buscamos todas as contas associadas a essa conexão
      const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${PLUGGY_ITEM_ID}`, {
        headers: { "X-API-KEY": apiKey },
      });

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new Error(`Failed to fetch Pluggy accounts for Item ${PLUGGY_ITEM_ID}: ${errText}`);
      }

      const { results: accounts } = await accountsRes.json();
      for (const acc of (accounts ?? [])) {
        if (acc.id) accountIds.push(acc.id);
      }
    }

    if (accountIds.length === 0) {
      throw new Error("Nenhuma conta bancária ativa encontrada para sincronização.");
    }

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

    let inserted = 0;
    let skipped = 0;

    // 4. Buscar e processar transações de cada conta identificada
    for (const accId of accountIds) {
      const txRes = await fetch(`https://api.pluggy.ai/transactions?accountId=${accId}&pageSize=100`, {
        headers: { "X-API-KEY": apiKey },
      });

      if (!txRes.ok) {
        console.error(`Failed to fetch transactions for account ${accId}`);
        continue;
      }

      const { results: transactions } = await txRes.json();

      for (const tx of (transactions ?? [])) {
        const rawAmount = Number(tx.amount);
        
        // Ignorar entradas (créditos).
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
    }

    return { inserted, skipped };
  });
