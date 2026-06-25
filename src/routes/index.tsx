import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
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

  // Ordena por risco: alta > media > baixa, depois por dias sem commit
  const sorted = useMemo(() => {
    const order = { alta: 0, media: 1, baixa: 2 };
    return [...stats].sort((a, b) => {
      const r = order[riskLevel(a)] - order[riskLevel(b)];
      if (r !== 0) return r;
      return (b.daysSinceLastCommit ?? 0) - (a.daysSinceLastCommit ?? 0);
    });
  }, [stats]);

  const counts = useMemo(() => {
    const c = { alta: 0, media: 0, baixa: 0 };
    stats.forEach((s) => c[riskLevel(s)]++);
    return c;
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-bold sm:text-lg">GitDash</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Acompanhamento de turmas via GitHub
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              aria-label="Sincronizar"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => supabase.auth.signOut()}
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

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {/* Resumo simples */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
            {counts.alta} precisam de atenção
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            {counts.media} a observar
          </Badge>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            {counts.baixa} em dia
          </Badge>
        </div>

        {/* Adicionar repo */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newRepo}
            onChange={(e) => setNewRepo(e.target.value)}
            placeholder="owner/repo (ex: facebook/react)"
            onKeyDown={(e) => e.key === "Enter" && addRepo()}
          />
          <Button onClick={addRepo}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {/* Lista de repositórios */}
        <div className="space-y-2">
          {loading && stats.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-20 animate-pulse bg-muted/40" />
            ))
          ) : sorted.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum repositório. Adicione um acima.
            </Card>
          ) : (
            sorted.map((s) => (
              <RepoRow
                key={s.fullName}
                s={s}
                onRemove={() => setRepos(repos.filter((x) => x !== s.fullName))}
              />
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Risco: <span className="text-red-600 dark:text-red-400">alta</span> = &gt;14 dias sem commit ou 0 na semana ·{" "}
          <span className="text-amber-600 dark:text-amber-400">média</span> = 6–14 dias ·{" "}
          <span className="text-emerald-600 dark:text-emerald-400">em dia</span> = ≤5 dias.
        </p>
      </main>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} repos={repos} />

      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90"
          aria-label="Abrir assistente IA"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Assistente IA</span>
        </button>
      )}
    </div>
  );
}

function RepoRow({ s, onRemove }: { s: RepoStat; onRemove: () => void }) {
  const risk = riskLevel(s);
  const dot = {
    alta: "bg-red-500",
    media: "bg-amber-500",
    baixa: "bg-emerald-500",
  }[risk];
  const label = {
    alta: "Atenção",
    media: "Observar",
    baixa: "Em dia",
  }[risk];

  return (
    <Card className="flex items-center gap-3 p-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} title={label} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium">{s.name}</span>
          <span className="truncate text-xs text-muted-foreground">{s.owner}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {s.error
            ? `Erro: ${s.error}`
            : s.daysSinceLastCommit == null
              ? "Sem commits"
              : `${s.daysSinceLastCommit}d sem commit · ${s.commitsLast7Days}/semana · ${s.uniqueAuthorsWeek} autor(es)`}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label={`Remover ${s.fullName}`}
      >
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
