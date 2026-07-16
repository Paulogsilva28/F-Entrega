import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LogOut, RefreshCw, Trash2, Plus, Archive, History } from "lucide-react";
import { listFoodWithdrawals, syncFoodWithdrawals } from "@/lib/gmail-sync.functions";
import { syncPluggyExpenses } from "@/lib/pluggy-sync.functions";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type Withdrawal = {
  id: string;
  amount: number;
  withdrawal_date: string;
};

type UberWithdrawal = Withdrawal & { note: string | null };

type Expense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  is_archived?: boolean;
  closed_at?: string | null;
};

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth", replace: true });
      else {
        setEmail(session.user.email ?? null);
        setUserId(session.user.id);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth", replace: true });
      else {
        setEmail(data.session.user.email ?? null);
        setUserId(data.session.user.id);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Painel Financeiro</h1>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {userId && <MonthSummary userId={userId} />}
        <Tabs defaultValue="food" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="food">Ganhos 99Food</TabsTrigger>
            <TabsTrigger value="uber">Ganhos Uber</TabsTrigger>
            <TabsTrigger value="moto">Gestão da Moto</TabsTrigger>
          </TabsList>
          <TabsContent value="food" className="mt-4">
            <FoodTab />
          </TabsContent>
          <TabsContent value="uber" className="mt-4">
            <UberTab />
          </TabsContent>
          <TabsContent value="moto" className="mt-4">
            <MotoTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function MonthSummary({ userId }: { userId: string }) {
  const [income99, setIncome99] = useState(0);
  const [incomeUber, setIncomeUber] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  const { start, end, label } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const label = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { start, end, label };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await listFoodWithdrawals({ data: { since: start.toISOString() } });
      const inc = (list ?? [])
        .filter((r) => new Date(r.withdrawal_date) < end)
        .reduce((s, r) => s + Number(r.amount), 0);
      setIncome99(inc);

      const { data: uberRows, error: uberErr } = await supabase
        .from("uber_withdrawals")
        .select("amount, withdrawal_date")
        .eq("user_id", userId)
        .gte("withdrawal_date", start.toISOString())
        .lt("withdrawal_date", end.toISOString());
      if (uberErr) throw uberErr;
      setIncomeUber((uberRows ?? []).reduce((s, r) => s + Number(r.amount), 0));

      const { data, error } = await supabase
        .from("moto_expenses")
        .select("amount")
        .eq("user_id", userId)
        .eq("is_archived", false);
      if (error) throw error;
      setExpenses((data ?? []).reduce((s, r) => s + Number(r.amount), 0));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar resumo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dashboard-summary")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moto_expenses", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "uber_withdrawals", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const income = income99 + incomeUber;
  const balance = income - expenses;
  const positive = balance >= 0;

  return (
    <Card
      className={`mb-4 border-2 ${
        positive ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Saldo Real do Mês — {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-3xl font-bold tabular-nums ${
            positive ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {loading ? "..." : BRL(balance)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <span>99: <span className="tabular-nums text-emerald-500">{BRL(income99)}</span></span>
          <span>Uber: <span className="tabular-nums text-emerald-500">{BRL(incomeUber)}</span></span>
          <span>Ganhos: <span className="tabular-nums text-emerald-500">{BRL(income)}</span></span>
          <span>Gastos: <span className="tabular-nums text-red-500">{BRL(expenses)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}

function FoodTab() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState<string>("3m");

  const { cutoff, label } = useMemo(() => {
    const d = new Date();
    let label = "";
    switch (period) {
      case "7d": d.setDate(d.getDate() - 7); label = "últimos 7 dias"; break;
      case "30d": d.setDate(d.getDate() - 30); label = "últimos 30 dias"; break;
      case "3m": d.setMonth(d.getMonth() - 3); label = "últimos 3 meses"; break;
      case "6m": d.setMonth(d.getMonth() - 6); label = "últimos 6 meses"; break;
      case "12m": d.setMonth(d.getMonth() - 12); label = "últimos 12 meses"; break;
      case "all": d.setFullYear(2000); label = "todo o período"; break;
    }
    return { cutoff: d, label };
  }, [period]);

  async function load() {
    setLoading(true);
    try {
      const data = await listFoodWithdrawals({ data: { since: cutoff.toISOString() } });
      setItems((data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })));
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao carregar saques");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncFoodWithdrawals();
      toast.success(`Sincronizado: ${res.inserted} novos, ${res.skipped} ignorados`);
      console.log("[sync] result", res);
      if (res.errors?.length) console.warn("Sync errors", res.errors);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total — {label}
            </CardTitle>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tabular-nums">{BRL(total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "saque" : "saques"} desde{" "}
            {cutoff.toLocaleDateString("pt-BR")}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSync} disabled={syncing} variant="secondary" className="w-full">
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando e-mails..." : "Sincronizar e-mails"}
      </Button>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor Plataforma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum saque encontrado. Clique em sincronizar.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {new Date(i.withdrawal_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(i.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MotoTab() {
  return <MotoTabInner />;
}

function UberTab() {
  const [items, setItems] = useState<UberWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<string>("3m");

  const { cutoff, label } = useMemo(() => {
    const d = new Date();
    let label = "";
    switch (period) {
      case "7d": d.setDate(d.getDate() - 7); label = "últimos 7 dias"; break;
      case "30d": d.setDate(d.getDate() - 30); label = "últimos 30 dias"; break;
      case "3m": d.setMonth(d.getMonth() - 3); label = "últimos 3 meses"; break;
      case "6m": d.setMonth(d.getMonth() - 6); label = "últimos 6 meses"; break;
      case "12m": d.setMonth(d.getMonth() - 12); label = "últimos 12 meses"; break;
      case "all": d.setFullYear(2000); label = "todo o período"; break;
    }
    return { cutoff: d, label };
  }, [period]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("uber_withdrawals")
      .select("id, amount, withdrawal_date, note")
      .gte("withdrawal_date", cutoff.toISOString())
      .order("withdrawal_date", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      return toast.error("Informe um valor válido.");
    }
    if (note.length > 200) {
      return toast.error("Observação muito longa (máx. 200).");
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return toast.error("Sessão expirada");
    }
    const { error } = await supabase.from("uber_withdrawals").insert({
      user_id: u.user.id,
      amount: value,
      withdrawal_date: new Date(date + "T12:00:00").toISOString(),
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    toast.success("Saque Uber adicionado");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("uber_withdrawals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((s) => s.filter((i) => i.id !== id));
  }

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Uber — {label}
            </CardTitle>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tabular-nums">{BRL(total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "saque" : "saques"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Novo saque Uber</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uamt">Valor (R$)</Label>
                <Input
                  id="uamt"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="udt">Data</Label>
                <Input id="udt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unote">Observação (opcional)</Label>
              <Input
                id="unote"
                placeholder="Ex: repasse semanal"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Adicionando..." : "Adicionar saque"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum saque cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(i.withdrawal_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{i.note ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(i.amount)}</TableCell>
                    <TableCell className="w-8">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir saque</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(i.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MotoTabInner() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [syncingPluggy, setSyncingPluggy] = useState(false);
  const [history, setHistory] = useState<Array<{ key: string; label: string; total: number; count: number }>>([]);

  async function handleSyncPluggy() {
    setSyncingPluggy(true);
    try {
      const res = await syncPluggyExpenses();
      toast.success(`${res.inserted} novos gastos importados, ${res.skipped} duplicados.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar com a Pluggy");
    } finally {
      setSyncingPluggy(false);
    }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("moto_expenses")
      .select("id, description, amount, expense_date")
      .eq("is_archived", false)
      .order("expense_date", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })));
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from("moto_expenses")
      .select("amount, expense_date, closed_at")
      .eq("is_archived", true)
      .order("expense_date", { ascending: false });
    if (error) return toast.error(error.message);
    const groups = new Map<string, { label: string; total: number; count: number }>();
    for (const row of data ?? []) {
      const d = new Date(row.expense_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const cur = groups.get(key) ?? { label, total: 0, count: 0 };
      cur.total += Number(row.amount);
      cur.count += 1;
      groups.set(key, cur);
    }
    setHistory(
      Array.from(groups.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([key, v]) => ({ key, ...v })),
    );
  }

  useEffect(() => {
    load();
    loadHistory();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(value) || value <= 0) {
      return toast.error("Preencha descrição e valor válidos.");
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return toast.error("Sessão expirada");
    }
    const { error } = await supabase.from("moto_expenses").insert({
      user_id: u.user.id,
      description: description.trim(),
      amount: value,
      expense_date: date,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("moto_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((s) => s.filter((i) => i.id !== id));
  }

  async function closeMonth() {
    setClosing(true);
    const { data, error } = await supabase.rpc("close_moto_month");
    setClosing(false);
    if (error) return toast.error(error.message);
    const count = Array.isArray(data) ? data[0]?.archived_count ?? 0 : 0;
    toast.success(
      count > 0
        ? `Mês fechado: ${count} ${count === 1 ? "gasto arquivado" : "gastos arquivados"}.`
        : "Nada para arquivar.",
    );
    await Promise.all([load(), loadHistory()]);
  }

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Novo gasto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                placeholder="Ex: Gasolina, óleo, manutenção"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amt">Valor (R$)</Label>
                <Input
                  id="amt"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dt">Data</Label>
                <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Adicionando..." : "Adicionar gasto"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button
        onClick={handleSyncPluggy}
        disabled={syncingPluggy}
        variant="secondary"
        className="w-full"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${syncingPluggy ? "animate-spin" : ""}`} />
        {syncingPluggy ? "Sincronizando Pluggy..." : "Sincronizar Extrato (Pluggy)"}
      </Button>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum gasto cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(i.expense_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{i.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(i.amount)}</TableCell>
                    <TableCell className="w-8">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(i.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={2} className="px-4 py-3 text-sm font-medium">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {BRL(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={closing}>
              <Archive className="mr-2 h-4 w-4" />
              {closing ? "Fechando..." : "Fechar Mês e Limpar"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fechar mês</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja arquivar os gastos atuais? Esta ação iniciará um novo ciclo financeiro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={closeMonth}>Arquivar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Histórico Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum mês fechado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.key}>
                    <TableCell className="capitalize">{h.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{h.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{BRL(h.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}