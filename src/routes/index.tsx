import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  GitCommit,
  Pause,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/ChatPanel";

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
        base.lastCommitDate = commits[0].commit.author.date;
        base.daysSinceLastCommit = Math.floor(
          (now - new Date(base.lastCommitDate).getTime()) / 86400000,
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📚</div>
            <div>
              <h1 className="text-lg font-bold">GitDash</h1>
              <p className="text-xs text-muted-foreground">Visão do professor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
            <Button
              size="sm"
              onClick={() => setChatOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Assistente IA
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Intro */}
        <section>
          <h2 className="text-2xl font-bold">Quem precisa da sua atenção agora?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Priorize alunos e projetos com menos sinais de progresso real. O foco aqui é acompanhamento, não ranking.
          </p>
        </section>

        {/* Add repo */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Adicionar repositório (formato owner/repo)
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
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPI
            icon={<Users className="h-5 w-5" />}
            value={summary.highRisk.length}
            label="Alunos para acompanhar"
            sub="com risco alto"
            tone="warning"
          />
          <KPI
            icon={<Pause className="h-5 w-5" />}
            value={summary.stalled.length}
            label="Projetos parados"
            sub="sem commits na semana"
            tone="danger"
          />
          <KPI
            icon={<GitCommit className="h-5 w-5" />}
            value={summary.totalCommits}
            label="Commits recentes"
            sub="últimos 7 dias"
            tone="info"
          />
          <KPI
            icon={<Activity className="h-5 w-5" />}
            value={`${stats.length ? Math.round((stats.length - summary.stalled.length) / stats.length * 100) : 0}%`}
            label="Projetos ativos"
            sub="com atividade na semana"
            tone="success"
          />
        </section>

        {/* Priority */}
        {summary.priority.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-semibold">Resumo de acompanhamento</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong>{summary.priority[0].owner}</strong> é o principal ponto de atenção —{" "}
                  {summary.priority[0].daysSinceLastCommit} dias sem commit em{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    {summary.priority[0].fullName}
                  </code>
                  . Chamar para check-in.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Project map */}
        <section>
          <h3 className="text-lg font-semibold">Mapa dos projetos</h3>
          <p className="text-sm text-muted-foreground">
            Cada card mostra risco pedagógico antes de virar problema na entrega.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading && stats.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted/40" />
                ))
              : stats.map((s) => <RepoCard key={s.fullName} s={s} />)}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          O dashboard prioriza sinais de acompanhamento docente. Commits indicam ritmo, mas não substituem avaliação de qualidade, testes ou entrega funcional.
        </p>
      </main>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} repos={repos} />

      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl transition-transform hover:scale-105"
          aria-label="Abrir assistente"
        >
          <Sparkles className="h-6 w-6" />
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
            <Stat n={s.commitsLast7Days} l="Semana" />
            <Stat n={s.commitsLast30Days} l="Mês" />
            <Stat n={s.uniqueAuthorsWeek} l="Ativos" />
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
