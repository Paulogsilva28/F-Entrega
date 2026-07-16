import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncPluggyExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    let PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
    let PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
    let PLUGGY_ITEM_ID = process.env.PLUGGY_ITEM_ID; // ID da conexão (Ex: obtido na URL do meu.pluggy.ai)
    let PLUGGY_ACCOUNT_ID = process.env.PLUGGY_ACCOUNT_ID; // ID da conta (opcional se tiver o ITEM_ID)

    if (PLUGGY_CLIENT_ID) PLUGGY_CLIENT_ID = PLUGGY_CLIENT_ID.trim();
    if (PLUGGY_CLIENT_SECRET) PLUGGY_CLIENT_SECRET = PLUGGY_CLIENT_SECRET.trim();
    if (PLUGGY_ITEM_ID) PLUGGY_ITEM_ID = PLUGGY_ITEM_ID.trim();
    if (PLUGGY_ACCOUNT_ID) PLUGGY_ACCOUNT_ID = PLUGGY_ACCOUNT_ID.trim();

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      throw new Error("Missing Pluggy environment variables: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET");
    }

    if (!PLUGGY_ITEM_ID && !PLUGGY_ACCOUNT_ID) {
      throw new Error("Você precisa configurar pelo menos o PLUGGY_ITEM_ID ou PLUGGY_ACCOUNT_ID no seu painel da Cloudflare.");
    }

    // 1. Autenticar na API da Pluggy para obter a apiKey
    console.log("[Pluggy] Authenticating with clientId:", PLUGGY_CLIENT_ID);
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
      console.error("[Pluggy] Authentication failed:", errText);
      throw new Error(`Pluggy authentication failed: ${errText}`);
    }

    const { apiKey } = await authRes.json();
    console.log("[Pluggy] Authenticated. apiKey acquired.");

    // 2. Determinar as contas (Account IDs) a serem sincronizadas
    const accountIds: string[] = [];

    if (PLUGGY_ACCOUNT_ID) {
      accountIds.push(PLUGGY_ACCOUNT_ID);
      console.log("[Pluggy] Using explicit accountId:", PLUGGY_ACCOUNT_ID);
    } else if (PLUGGY_ITEM_ID) {
      console.log("[Pluggy] Fetching item status first for:", PLUGGY_ITEM_ID);
      const itemRes = await fetch(`https://api.pluggy.ai/items/${PLUGGY_ITEM_ID}`, {
        headers: { "X-API-KEY": apiKey },
      });
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        console.log("[Pluggy] Item status:", itemData.status, "executionStatus:", itemData.executionStatus, "itemRaw:", JSON.stringify(itemData));
      } else {
        console.error("[Pluggy] Failed to fetch item info:", await itemRes.text());
      }

      console.log("[Pluggy] Fetching accounts for itemId:", PLUGGY_ITEM_ID);
      const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${PLUGGY_ITEM_ID}`, {
        headers: { "X-API-KEY": apiKey },
      });

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        console.error("[Pluggy] Failed to fetch accounts:", errText);
        throw new Error(`Failed to fetch Pluggy accounts for Item ${PLUGGY_ITEM_ID}: ${errText}`);
      }

      const accData = await accountsRes.json();
      console.log("[Pluggy] Accounts raw response:", JSON.stringify(accData));
      let accounts = accData.results ?? [];

      if (accounts.length === 0) {
        console.log("[Pluggy] Accounts list was empty. Trying workspace fallback (fetching all accounts)...");
        const allAccsRes = await fetch("https://api.pluggy.ai/accounts", {
          headers: { "X-API-KEY": apiKey },
        });
        if (allAccsRes.ok) {
          const allAccsData = await allAccsRes.json();
          console.log("[Pluggy] Workspace fallback accounts response:", JSON.stringify(allAccsData));
          const allAccs = allAccsData.results ?? [];
          accounts = allAccs.filter((a: any) => a.itemId === PLUGGY_ITEM_ID);
          console.log("[Pluggy] Workspace fallback matched accounts count:", accounts.length);
        } else {
          console.error("[Pluggy] Workspace fallback fetch failed:", await allAccsRes.text());
        }
      }

      console.log("[Pluggy] Extracted accounts count:", accounts.length);
      for (const acc of accounts) {
        console.log("[Pluggy] Account found:", acc.id, acc.name, acc.type);
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
      const txRes = await fetch(`https://api.pluggy.ai/v2/transactions?accountId=${accId}`, {
        headers: { "X-API-KEY": apiKey },
      });

      if (!txRes.ok) {
        const errText = await txRes.text();
        console.error(`Failed to fetch transactions for account ${accId}:`, errText);
        continue;
      }

      const { results: transactions } = await txRes.json();
      console.log(`[Pluggy] Fetched ${transactions?.length ?? 0} transactions for account ${accId}`);
      if (transactions && transactions.length > 0) {
        console.log(`[Pluggy] Sample transaction: ${transactions[0].description} | Amount: ${transactions[0].amount}`);
      }

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
