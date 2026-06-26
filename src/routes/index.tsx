import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Book,
  GitCommit,
  GitFork,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";

import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  language: string | null;
  stars: number;
  forks: number;
  lastCommitDate: string | null;
  daysSinceLastCommit: number | null;
  commitsLast7Days: number;
  commitsLast30Days: number;
  uniqueAuthorsWeek: number;
  ownerAvatar: string | null;
  error?: string;
};

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Vue: "#41b883",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
};

async function fetchRepoStat(fullName: string): Promise<RepoStat> {
  const [owner, name] = fullName.split("/");
  const base: RepoStat = {
    fullName,
    owner,
    name,
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    lastCommitDate: null,
    daysSinceLastCommit: null,
    commitsLast7Days: 0,
    commitsLast30Days: 0,
    uniqueAuthorsWeek: 0,
    ownerAvatar: null,
  };
  try {
    const meta = await fetch(`https://api.github.com/repos/${fullName}`);
    if (!meta.ok) throw new Error(`${meta.status}`);
    const metaJson = await meta.json();
    base.description = metaJson.description;
    base.language = metaJson.language;
    base.stars = metaJson.stargazers_count ?? 0;
    base.forks = metaJson.forks_count ?? 0;
    base.ownerAvatar = metaJson.owner?.avatar_url ?? null;

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

function relativeTime(days: number | null): string {
  if (days == null) return "sem commits";
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} anos`;
}

function Dashboard() {
  const [repos, setRepos] = useState<string[]>(DEFAULT_REPOS);
  const [stats, setStats] = useState<RepoStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRepo, setNewRepo] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "alta" | "media" | "baixa">("todos");

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

  const counts = useMemo(() => {
    const c = { alta: 0, media: 0, baixa: 0 };
    stats.forEach((s) => c[riskLevel(s)]++);
    return c;
  }, [stats]);

  const filtered = useMemo(() => {
    const order = { alta: 0, media: 1, baixa: 2 };
    return [...stats]
      .filter((s) => filter === "todos" || riskLevel(s) === filter)
      .filter((s) =>
        query.trim() === ""
          ? true
          : s.fullName.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => {
        const r = order[riskLevel(a)] - order[riskLevel(b)];
        if (r !== 0) return r;
        return (b.daysSinceLastCommit ?? 0) - (a.daysSinceLastCommit ?? 0);
      });
  }, [stats, filter, query]);

  const totalCommits7 = stats.reduce((a, s) => a + s.commitsLast7Days, 0);

  const addRepo = () => {
    const trimmed = newRepo.trim();
    if (!trimmed.includes("/")) return;
    if (repos.includes(trimmed)) return;
    setRepos([...repos, trimmed]);
    setNewRepo("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav — estilo GitHub */}
      <header className="sticky top-0 z-10 border-b border-border bg-[#0d1117] text-white dark:bg-[#010409]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <svg viewBox="0 0 16 16" className="h-6 w-6 fill-white" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitDash</span>
          </Link>

          <div className="relative ml-2 hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar repositório…"
              className="h-8 w-full max-w-md rounded-md border border-white/15 bg-white/5 pl-8 pr-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              aria-label="Sincronizar"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            {user ? (
              <>
                <div className="hidden h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold sm:flex">
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => supabase.auth.signOut()}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/auth">
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Entrar</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar estilo GitHub */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {(user?.email?.[0] ?? "P").toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {user?.email ?? "Professor"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {repos.length} repositórios
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-base font-semibold">{counts.alta}</div>
                <div className="text-muted-foreground">Atenção</div>
              </div>
              <div>
                <div className="text-base font-semibold">{counts.media}</div>
                <div className="text-muted-foreground">Observar</div>
              </div>
              <div>
                <div className="text-base font-semibold">{counts.baixa}</div>
                <div className="text-muted-foreground">Em dia</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <GitCommit className="h-4 w-4" /> Atividade
            </div>
            <div className="text-xs text-muted-foreground">
              {totalCommits7} commits na última semana
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Filtros</div>
            <div className="flex flex-col gap-1 text-sm">
              {(["todos", "alta", "media", "baixa"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 text-left transition-colors ${
                    filter === f
                      ? "bg-accent font-medium"
                      : "hover:bg-accent/50 text-muted-foreground"
                  }`}
                >
                  {f === "todos"
                    ? "Todos"
                    : f === "alta"
                      ? "🔴 Precisam de atenção"
                      : f === "media"
                        ? "🟡 A observar"
                        : "🟢 Em dia"}
                </button>
              ))}
            </div>
          </Card>

          <div className="text-[11px] leading-relaxed text-muted-foreground">
            <strong>Risco:</strong> alta = &gt;14d ou 0 commits/semana · média = 6–14d · em dia = ≤5d.
          </div>
        </aside>

        {/* Conteúdo principal */}
        <main className="space-y-4">
          {/* Busca mobile */}
          <div className="relative sm:hidden">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar repositório…"
              className="pl-8"
            />
          </div>

          {/* Adicionar repo */}
          <Card className="p-3">
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
          </Card>

          {/* Cabeçalho da lista */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-semibold">
              Repositórios{" "}
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {filtered.length}
              </span>
            </h2>
          </div>

          {/* Lista estilo GitHub */}
          <div className="divide-y divide-border rounded-md border border-border">
            {loading && stats.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse bg-muted/40" />
              ))
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum repositório encontrado.
              </div>
            ) : (
              filtered.map((s) => (
                <RepoItem
                  key={s.fullName}
                  s={s}
                  onRemove={() =>
                    setRepos(repos.filter((x) => x !== s.fullName))
                  }
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function RepoItem({ s, onRemove }: { s: RepoStat; onRemove: () => void }) {
  const risk = riskLevel(s);
  const riskBadge = {
    alta: (
      <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400">
        Atenção
      </Badge>
    ),
    media: (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Observar
      </Badge>
    ),
    baixa: (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        Em dia
      </Badge>
    ),
  }[risk];

  const langColor = s.language ? LANG_COLORS[s.language] ?? "#888" : null;

  return (
    <div className="flex gap-3 p-4 hover:bg-accent/30">
      {s.ownerAvatar ? (
        <img
          src={s.ownerAvatar}
          alt={s.owner}
          className="h-8 w-8 shrink-0 rounded-full"
          loading="lazy"
        />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={`https://github.com/${s.fullName}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-baseline gap-1.5 text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <Book className="h-4 w-4 self-center text-muted-foreground" />
            <span className="text-muted-foreground">{s.owner}</span>
            <span className="text-muted-foreground">/</span>
            <span>{s.name}</span>
          </a>
          <Badge variant="outline" className="text-[10px] font-normal">
            Public
          </Badge>
          {riskBadge}
        </div>

        {s.description && (
          <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
        )}
        {s.error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Erro ao carregar: {s.error}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {s.language && (
            <span className="flex items-center gap-1">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: langColor ?? "#888" }}
              />
              {s.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" /> {s.stars}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3.5 w-3.5" /> {s.forks}
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="h-3.5 w-3.5" /> {s.commitsLast7Days}/semana ·{" "}
            {s.commitsLast30Days}/mês
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {s.uniqueAuthorsWeek} autor(es)
          </span>
          <span>Atualizado {relativeTime(s.daysSinceLastCommit)}</span>
        </div>
      </div>

      <button
        onClick={onRemove}
        className="self-start text-muted-foreground transition-colors hover:text-destructive"
        aria-label={`Remover ${s.fullName}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
