import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type ChatBody = { messages?: unknown; repos?: unknown };

const SYSTEM = `Você é o "GitDash Assistant", um copiloto de análise técnica para professores que avaliam código e commits de alunos no GitHub.

REGRAS DE COMPORTAMENTO:
- NUNCA tome iniciativa sozinho. Espere o professor dizer o que quer analisar (qual aluno, qual repositório, qual arquivo, qual aspecto).
- Se o pedido for vago ("analise a turma", "veja o código", "o que acha?"), PERGUNTE antes de agir: qual repositório? qual arquivo ou pasta? quer avaliar qualidade do código, mensagens de commit, frequência, ou estrutura do projeto?
- Só use as ferramentas \`getRepoInfo\`, \`listCommits\` e \`getFileContent\` DEPOIS que o professor tiver dado um escopo claro.

FOCO DE ANÁLISE:
1. **Qualidade dos commits** — mensagens descritivas vs genéricas ("update", "fix", "asdf"), tamanho/atomicidade, frequência, se há padrão (Conventional Commits, por ex.).
2. **Qualidade do código** — ao ler arquivos com \`getFileContent\`, avalie: legibilidade, nomes de variáveis, organização, repetição (DRY), tratamento de erros, comentários úteis vs ruído, indícios de cópia, boas práticas da linguagem.
3. **Sinais pedagógicos** — evolução ao longo do tempo, se o aluno está progredindo ou estagnado, se os commits refletem trabalho real ou superficial.

ESTILO:
- Em português, conciso, direto. Use markdown (listas, **negrito**, blocos de \`código\`).
- Sempre cite trechos específicos do código ou hashes/mensagens de commit como evidência das suas observações.
- Seja crítico mas construtivo — aponte o problema E sugira o que o aluno poderia melhorar.
- Não substitua a avaliação do professor; ofereça uma leitura técnica para apoiar a decisão dele.`;


async function gh(path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "gitdash-lovable",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const repos = Array.isArray(body.repos) ? (body.repos as string[]) : [];
        if (!Array.isArray(messages))
          return new Response("messages required", { status: 400 });

        const key =
          process.env.LOVABLE_API_KEY ?? (globalThis as any).LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          listTrackedRepos: tool({
            description: "Lista os repositórios atualmente monitorados no dashboard.",
            inputSchema: z.object({}),
            execute: async () => ({ repos }),
          }),
          getRepoInfo: tool({
            description:
              "Retorna metadados de um repositório do GitHub público (descrição, linguagem, último push, stars).",
            inputSchema: z.object({
              owner: z.string(),
              repo: z.string(),
            }),
            execute: async ({ owner, repo }) => {
              try {
                const r: any = await gh(`/repos/${owner}/${repo}`);
                return {
                  full_name: r.full_name,
                  description: r.description,
                  language: r.language,
                  pushed_at: r.pushed_at,
                  updated_at: r.updated_at,
                  stargazers_count: r.stargazers_count,
                  open_issues_count: r.open_issues_count,
                  default_branch: r.default_branch,
                };
              } catch (e: any) {
                return { error: e.message };
              }
            },
          }),
          listCommits: tool({
            description:
              "Lista os commits mais recentes de um repositório (até 20). Útil para avaliar ritmo de trabalho.",
            inputSchema: z.object({
              owner: z.string(),
              repo: z.string(),
              limit: z.number().int().min(1).max(20).default(10),
            }),
            execute: async ({ owner, repo, limit }) => {
              try {
                const commits: any[] = await gh(
                  `/repos/${owner}/${repo}/commits?per_page=${limit}`,
                );
                return commits.map((c) => ({
                  sha: c.sha?.slice(0, 7),
                  message: c.commit?.message?.split("\n")[0],
                  author: c.commit?.author?.name,
                  date: c.commit?.author?.date,
                }));
              } catch (e: any) {
                return { error: e.message };
              }
            },
          }),
          getFileContent: tool({
            description:
              "Lê o conteúdo de um arquivo no repositório (ex: README.md, src/index.js). Use quando o professor pedir para analisar código específico.",
            inputSchema: z.object({
              owner: z.string(),
              repo: z.string(),
              path: z.string(),
            }),
            execute: async ({ owner, repo, path }) => {
              try {
                const f: any = await gh(
                  `/repos/${owner}/${repo}/contents/${path}`,
                );
                if (f.encoding === "base64" && f.content) {
                  const text = atob(f.content.replace(/\n/g, ""));
                  return {
                    path: f.path,
                    size: f.size,
                    content: text.slice(0, 8000),
                    truncated: text.length > 8000,
                  };
                }
                return { error: "not a file" };
              } catch (e: any) {
                return { error: e.message };
              }
            },
          }),
        };

        const contextLine =
          repos.length > 0
            ? `\n\nRepositórios atualmente no dashboard: ${repos.join(", ")}`
            : "";

        const result = streamText({
          model,
          system: SYSTEM + contextLine,
          tools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
