import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatPanel({
  open,
  onClose,
  repos,
}: {
  open: boolean;
  onClose: () => void;
  repos: string[];
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { repos },
    }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  if (!open) return null;

  const loading = status === "submitted" || status === "streaming";

  const suggestions = [
    "Analise a qualidade das mensagens de commit em ThomasOnTraining/Gitdash",
    "Leia o README de gb-eli/Iniciando-com-Python-no-DS1-SUB e me diga o que melhorar",
    "Avalie a qualidade do código em src/App.tsx de ThomasOnTraining/Gitdash",
    "Os últimos commits de Colegio-Alberto-Gomes-Veiga/meu-primeiro-reposit-rio- mostram progresso real?",
  ];


  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Análise técnica de código</div>
            <div className="text-xs text-muted-foreground">
              Conectado a {repos.length} repo(s)
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Olá! Posso analisar commits, ler arquivos e ajudar com check-ins.
              O que você quer saber?
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage({ text: s })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const toolParts = m.parts.filter((p) => p.type.startsWith("tool-"));
          return (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {toolParts.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {toolParts.map((tp: any, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-background/50 px-2 py-1 text-xs opacity-80"
                      >
                        🔧 {tp.type.replace("tool-", "")}
                        {tp.state === "output-available" && " ✓"}
                      </div>
                    ))}
                  </div>
                )}
                {text && (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || loading) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre a turma..."
          disabled={loading}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
