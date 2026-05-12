import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Loader2, ChevronDown, Wrench, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const AssistantDock = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${SUPABASE_URL}/functions/v1/ai-assistant`,
      body: () => ({ conversationId: conversationIdRef.current }),
      fetch: async (url, init) => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = new Headers(init?.headers);
        if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
        headers.set("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
        const res = await fetch(url, { ...init, headers });
        const cid = res.headers.get("x-conversation-id");
        if (cid) conversationIdRef.current = cid;
        return res;
      },
    }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    sendMessage({ text });
    setInput("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-gradient-fire text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 transition animate-fade-in"
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  const isWorking = status === "streaming" || status === "submitted";

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-2rem))] glass-card rounded-2xl shadow-glow flex flex-col overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-fire/5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-fire flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Firecrawl AI</div>
            <div className="text-[10px] text-muted-foreground">Gemini 3 Flash · scrape · search · map</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open full chat">
            <Link to={conversationIdRef.current ? `/assistant/${conversationIdRef.current}` : "/assistant"}>
              <Maximize2 className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <Sparkles className="h-8 w-8 mx-auto text-primary mb-3" />
            <div className="text-sm font-medium mb-1">Ask me anything web-related</div>
            <div className="text-xs text-muted-foreground mb-4">I can scrape pages, search the web, and map sites for you.</div>
            <div className="space-y-1.5 text-xs">
              {[
                "Scrape lovable.dev and summarize it",
                "Search the web for top vector DBs in 2026",
                "Map firecrawl.dev",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage({ text: p })}
                  className="block w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition"
                >{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const streaming = isLast && m.role === "assistant" && isWorking;
          return <MessageRow key={m.id} message={m} streaming={streaming} />;
        })}

        {status === "submitted" && (
          <div className="text-sm text-shimmer font-medium">Thinking…</div>
        )}
        {error && (
          <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-lg p-2">
            {error.message}
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-border p-3 flex gap-2 bg-card/50">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistant…"
          autoFocus
          className="h-10"
        />
        <Button type="submit" disabled={isWorking || !input.trim()} size="icon" className="h-10 w-10 bg-gradient-fire">
          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};

const MessageRow = ({ message, streaming }: { message: any; streaming: boolean }) => {
  const isUser = message.role === "user";
  const textParts = (message.parts || []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
  const toolParts = (message.parts || []).filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-"));

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm">
          {textParts}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {toolParts.map((p: any, idx: number) => <ToolCard key={idx} part={p} />)}
      {textParts && (
        <div className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed ${streaming ? "[&_p]:text-shimmer [&_li]:text-shimmer [&>*]:text-shimmer" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{textParts}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const ToolCard = ({ part }: { part: any }) => {
  const [openDetails, setOpenDetails] = useState(false);
  const name = String(part.type || "").replace(/^tool-/, "");
  const state = part.state || "input-available";
  const running = state === "input-streaming" || state === "input-available";
  const failed = state === "output-error";

  return (
    <div className="rounded-xl border border-border bg-background/60 overflow-hidden text-xs">
      <button
        onClick={() => setOpenDetails((s) => !s)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition text-left"
      >
        <Wrench className={`h-3.5 w-3.5 ${failed ? "text-destructive" : "text-primary"}`} />
        <span className="font-mono">{name}</span>
        {running && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        {!running && !failed && <span className="text-[10px] text-emerald-500 ml-1">done</span>}
        {failed && <span className="text-[10px] text-destructive ml-1">error</span>}
        <ChevronDown className={`h-3 w-3 ml-auto transition ${openDetails ? "rotate-180" : ""}`} />
      </button>
      {openDetails && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
          {part.input && (
            <pre className="text-[10px] bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(part.input, null, 2)}</pre>
          )}
          {part.output && (
            <pre className="text-[10px] bg-muted/40 p-2 rounded overflow-x-auto max-h-60">{JSON.stringify(part.output, null, 2)}</pre>
          )}
          {part.errorText && (
            <div className="text-destructive">{part.errorText}</div>
          )}
        </div>
      )}
    </div>
  );
};