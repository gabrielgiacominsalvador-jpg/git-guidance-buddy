import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  GitCommit,
  LogIn,
  LogOut,
  Pause,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/ChatPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const DEFAULT_REPOS = [
  "ThomasOnTraining/Gitdash",
  "gb-eli/Iniciando-com-Python-no-DS1-SUB",
  "Colegio-Alberto-Gomes-Veiga/meu-primeiro-reposit-rio-",
];

type RepoStat = {
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  lastCommitDate: string | null;
  daysSinceLastCommit: number | null;
  commitsLast7Days: number;
  commitsLast30Days: number;
  uniqueAuthorsWeek: number;
  error?: string;
};

async function fetchRepoStat(fullName: string): Promise<RepoStat> {
  const [owner, name] = fullName.split("/");
  const base: RepoStat = {
    fullName,
    owner,
    name,
    description: null,
    lastCommitDate: null,
    daysSinceLastCommit: null,
    commitsLast7Days: 0,
    commitsLast30Days: 0,
    uniqueAuthorsWeek: 0,
  };
  try {
    const meta = await fetch(`https://api.github.com/repos/${fullName}`);
    if (!meta.ok) throw new Error(`${meta.status}`);
    const metaJson = await meta.json();
    base.description = metaJson.description;

    const commitsRes = await fetch(
      `https://api.github.com/repos/${fullName}/commits?per_page=100`,
    );
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      const now = Date.now();
      const authors7 = new Set<string>();
      for (const c of commits) {
        const d = c.commit?.author?.date;
        if (!d) continue;
        const age = (now - new Date(d).getTime()) / 86400000;
        if (age <= 7) {
          base.commitsLast7Days++;
          if (c.author?.login) authors7.add(c.author.login);
        }
        if (age <= 30) base.commitsLast30Days++;
      }
      base.uniqueAuthorsWeek = authors7.size;
      if (commits[0]?.commit?.author?.date) {
        const d: string = commits[0].commit.author.date;
        base.lastCommitDate = d;
        base.daysSinceLastCommit = Math.floor(
          (now - new Date(d).getTime()) / 86400000,
        );
      }
    }
  } catch (e: any) {
    base.error = e.message;
  }
  return base;
}

function riskLevel(s: RepoStat): "alta" | "media" | "baixa" {
  if (s.daysSinceLastCommit == null) return "alta";
  if (s.daysSinceLastCommit > 14 || s.commitsLast7Days === 0) return "alta";
  if (s.daysSinceLastCommit > 5) return "media";
  return "baixa";
}

function Dashboard() {
  const [repos, setRepos] = useState<string[]>(DEFAULT_REPOS);
  const [stats, setStats] = useState<RepoStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRepo, setNewRepo] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const results = await Promise.all(repos.map(fetchRepoStat));
    setStats(results);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos]);

  const summary = useMemo(() => {
    const highRisk = stats.filter((s) => riskLevel(s) === "alta");
    const stalled = stats.filter((s) => s.commitsLast7Days === 0);
    const totalCommits = stats.reduce((a, s) => a + s.commitsLast7Days, 0);
    const priority = [...stats]
      .sort(
        (a, b) =>
          (b.daysSinceLastCommit ?? 0) - (a.daysSinceLastCommit ?? 0),
      )
      .filter((s) => riskLevel(s) === "alta");
    return { highRisk, stalled, totalCommits, priority };
  }, [stats]);

  const addRepo = () => {
    const trimmed = newRepo.trim();
    if (!trimmed.includes("/")) return;
    if (repos.includes(trimmed)) return;
    setRepos([...repos, trimmed]);
    setNewRepo("");
  };

  const activePct = stats.length
    ? Math.round(((stats.length - summary.stalled.length) / stats.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">📚</div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">GitDash</h1>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Acompanhamento de turmas via GitHub
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              aria-label="Sincronizar dados"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => supabase.auth.signOut()}
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Entrar</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Intro / como ler */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">
              Quem precisa da sua atenção agora?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre os repositórios da turma e veja, em um relance, quais alunos
              estão sem progresso recente.
            </p>
          </div>

          {/* Legenda — como o risco é calculado */}
          <Card className="bg-muted/30 p-3 text-xs sm:text-sm">
            <div className="mb-1.5 font-semibold">Como o risco é calculado</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <span className="font-medium text-red-600 dark:text-red-400">Alta atenção</span> —
                mais de 14 dias sem commit ou nenhum commit na última semana.
              </li>
              <li>
                <span className="font-medium text-amber-600 dark:text-amber-400">Média atenção</span> —
                último commit entre 6 e 14 dias atrás.
              </li>
              <li>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Em dia</span> —
                commit nos últimos 5 dias.
              </li>
            </ul>
          </Card>
        </section>

        {/* Add repo */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Adicionar repositório do GitHub (formato <code className="rounded bg-muted px-1">owner/repo</code>)
              </label>
              <Input
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="ex: facebook/react"
                onKeyDown={(e) => e.key === "Enter" && addRepo()}
                className="mt-1"
              />
            </div>
            <Button onClick={addRepo}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
          {repos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {repos.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1">
                  {r}
                  <button
                    onClick={() => setRepos(repos.filter((x) => x !== r))}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Remover ${r}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* KPIs — resumo da turma */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo da turma
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPI
              icon={<Users className="h-5 w-5" />}
              value={summary.highRisk.length}
              label="Precisam de atenção"
              sub={`de ${stats.length} repositório(s)`}
              tone="warning"
            />
            <KPI
              icon={<Pause className="h-5 w-5" />}
              value={summary.stalled.length}
              label="Parados esta semana"
              sub="0 commits nos últimos 7 dias"
              tone="danger"
            />
            <KPI
              icon={<GitCommit className="h-5 w-5" />}
              value={summary.totalCommits}
              label="Commits na semana"
              sub="somando todos os repos"
              tone="info"
            />
            <KPI
              icon={<Activity className="h-5 w-5" />}
              value={`${activePct}%`}
              label="Repos ativos"
              sub="com ao menos 1 commit/semana"
              tone="success"
            />
          </div>
        </section>

        {/* Priority */}
        {summary.priority.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Ação sugerida</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comece por{" "}
                  <strong className="text-foreground">
                    {summary.priority[0].owner}
                  </strong>{" "}
                  — {summary.priority[0].daysSinceLastCommit ?? "?"} dia(s) sem commit em{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    {summary.priority[0].fullName}
                  </code>
                  . Vale um check-in.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Project map */}
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">Projetos ({stats.length})</h3>
            <span className="text-xs text-muted-foreground">
              Ordenado por cadastro
            </span>
          </div>

          {stats.length === 0 && !loading ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum repositório cadastrado. Adicione um acima para começar.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {loading && stats.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="h-48 animate-pulse bg-muted/40" />
                  ))
                : stats.map((s) => <RepoCard key={s.fullName} s={s} />)}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Commits indicam ritmo de trabalho, mas não substituem avaliação de
          qualidade, testes ou entrega funcional. Use o assistente de IA (canto
          inferior direito) para análises mais profundas.
        </p>
      </main>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} repos={repos} />

      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-xl transition-transform hover:scale-105"
          aria-label="Abrir assistente de IA"
        >
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">Assistente IA</span>
        </button>
      )}
    </div>
  );
}

function KPI({
  icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub: string;
  tone: "warning" | "danger" | "info" | "success";
}) {
  const colors: Record<string, string> = {
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-700 dark:text-red-400",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <Card className="p-4">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[tone]}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function RepoCard({ s }: { s: RepoStat }) {
  const risk = riskLevel(s);
  const riskMap = {
    alta: { label: "Alta atenção", cls: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" },
    media: { label: "Média atenção", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    baixa: { label: "Em dia", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{s.owner}</div>
          <div className="truncate font-semibold">{s.name}</div>
        </div>
        <Badge variant="outline" className={riskMap[risk].cls}>
          {riskMap[risk].label}
        </Badge>
      </div>
      {s.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
      )}
      {s.error ? (
        <p className="mt-3 text-xs text-red-600">Erro: {s.error}</p>
      ) : (
        <>
          <div className="mt-3 text-sm">
            {s.daysSinceLastCommit == null
              ? "Sem commits encontrados"
              : `Sem progresso há ${s.daysSinceLastCommit} dia(s)`}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <Stat n={s.commitsLast7Days} l="Commits/semana" />
            <Stat n={s.commitsLast30Days} l="Commits/mês" />
            <Stat n={s.uniqueAuthorsWeek} l="Autores/semana" />

          </div>
        </>
      )}
    </Card>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-lg font-bold">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
    </div>
  );
}
