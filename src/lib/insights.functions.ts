import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CACHE_HOURS = 24;
const MODEL = "google/gemini-2.5-flash";

function monthBounds(monthStr: string) {
  // monthStr: YYYY-MM
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const prevStart = new Date(Date.UTC(y, m - 2, 1));
  const prevEnd = start;
  const firstDay = `${monthStr}-01`;
  return { start, end, prevStart, prevEnd, firstDay };
}

async function aggregateMonth(supabase: any, userId: string, start: Date, end: Date) {
  const [food, uber, moto] = await Promise.all([
    supabase
      .from("food_withdrawals")
      .select("amount")
      .eq("user_id", userId)
      .gte("withdrawal_date", start.toISOString())
      .lt("withdrawal_date", end.toISOString()),
    supabase
      .from("uber_withdrawals")
      .select("amount")
      .eq("user_id", userId)
      .gte("withdrawal_date", start.toISOString())
      .lt("withdrawal_date", end.toISOString()),
    supabase
      .from("moto_expenses")
      .select("amount, description")
      .eq("user_id", userId)
      .gte("expense_date", start.toISOString().slice(0, 10))
      .lt("expense_date", end.toISOString().slice(0, 10)),
  ]);

  const sum = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const food99 = sum(food.data);
  const ganhosUber = sum(uber.data);
  const totalGastos = sum(moto.data);

  // Categorização leve por palavra-chave (sem enviar descrição livre à IA)
  const categorias: Record<string, number> = {
    combustivel: 0,
    manutencao: 0,
    aluguel: 0,
    seguro: 0,
    outros: 0,
  };
  for (const r of moto.data ?? []) {
    const d = String(r.description ?? "").toLowerCase();
    const v = Number(r.amount);
    if (/gasolina|combust|etanol|posto|alcool/.test(d)) categorias.combustivel += v;
    else if (/manuten|oleo|óleo|pneu|revis|pe[çc]a|conserto|mec/.test(d)) categorias.manutencao += v;
    else if (/alug/.test(d)) categorias.aluguel += v;
    else if (/seguro|ipva|licen/.test(d)) categorias.seguro += v;
    else categorias.outros += v;
  }

  return {
    food99: Math.round(food99 * 100) / 100,
    uber: Math.round(ganhosUber * 100) / 100,
    gastosTotal: Math.round(totalGastos * 100) / 100,
    gastosPorCategoria: Object.fromEntries(
      Object.entries(categorias).map(([k, v]) => [k, Math.round(v * 100) / 100]),
    ),
    contagemLancamentos:
      (food.data?.length ?? 0) + (uber.data?.length ?? 0) + (moto.data?.length ?? 0),
  };
}

async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (res.status === 429) {
    throw new Error("Muitas requisições. Tente novamente em alguns instantes.");
  }
  if (res.status === 402) {
    throw new Error("Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
  }
  if (!res.ok) {
    const t = await res.text();
    console.error("[insights] AI gateway error", res.status, t);
    throw new Error("Erro ao gerar análise. Tente novamente.");
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") throw new Error("Resposta vazia da IA");
  return text.trim();
}

async function generate(supabase: any, userId: string, monthStr: string) {
  const { start, end, prevStart, prevEnd, firstDay } = monthBounds(monthStr);
  const [atual, anterior] = await Promise.all([
    aggregateMonth(supabase, userId, start, end),
    aggregateMonth(supabase, userId, prevStart, prevEnd),
  ]);

  if (atual.contagemLancamentos === 0) {
    return {
      content: "Sem lançamentos neste mês ainda. Adicione saques ou gastos para gerar uma análise.",
      generated_at: new Date().toISOString(),
      empty: true as const,
    };
  }

  const system =
    "Você é um analista financeiro de motoristas de aplicativo (Uber/99). " +
    "Analise os números do mês e gere 3 a 5 bullets curtos em português brasileiro. " +
    "Use R$ para valores. Compare com o mês anterior quando fizer sentido. " +
    "Foque em ações práticas. Não invente dados. Comece cada bullet com '- '. " +
    "Sem cabeçalhos, sem texto introdutório, sem markdown extra.";

  const user = JSON.stringify({
    mes_atual: { ...atual, periodo: monthStr },
    mes_anterior: anterior,
    saldo_atual: Math.round((atual.food99 + atual.uber - atual.gastosTotal) * 100) / 100,
    saldo_anterior:
      Math.round((anterior.food99 + anterior.uber - anterior.gastosTotal) * 100) / 100,
  });

  const content = await callLovableAI(system, user);
  const generated_at = new Date().toISOString();

  const { error } = await supabase
    .from("monthly_insights")
    .upsert(
      { user_id: userId, month: firstDay, content, generated_at },
      { onConflict: "user_id,month" },
    );
  if (error) console.error("[insights] upsert error", error);

  return { content, generated_at, empty: false as const };
}

export const getMonthlyInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { month: string }) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { firstDay } = monthBounds(data.month);

    const { data: cached } = await supabase
      .from("monthly_insights")
      .select("content, generated_at")
      .eq("user_id", userId)
      .eq("month", firstDay)
      .maybeSingle();

    if (cached?.generated_at) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < CACHE_HOURS * 3600 * 1000) {
        return {
          content: cached.content,
          generated_at: cached.generated_at,
          empty: false as const,
        };
      }
    }

    return await generate(supabase, userId, data.month);
  });

export const regenerateMonthlyInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { month: string }) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { firstDay } = monthBounds(data.month);

    await supabase
      .from("monthly_insights")
      .delete()
      .eq("user_id", userId)
      .eq("month", firstDay);

    return await generate(supabase, userId, data.month);
  });
