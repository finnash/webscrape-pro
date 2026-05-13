import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useThreads, loadThreadMessages } from "@/hooks/useThreads";
import { Sparkles, Plus, Trash2, Send, Loader2, Wrench, ChevronDown, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function Assistant() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { threads, loading: threadsLoading, refresh, remove } = useThreads();
  const [initialMessages, setInitialMessages] = useState<any[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Load saved messages for the active thread
  useEffect(() => {
    let cancelled = false;
    if (!threadId) { setInitialMessages([]); return; }
    setLoadingMsgs(true);
    loadThreadMessages(threadId).then((msgs) => {
      if (!cancelled) { setInitialMessages(msgs); setLoadingMsgs(false); }
    });
    return () => { cancelled = true; };
  }, [threadId]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-0px)] md:h-screen overflow-hidden">
        {/* Thread rail */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/30">
          <div className="p-3 border-b border-border">
            <Button
              onClick={() => navigate("/assistant")}
              className="w-full bg-gradient-fire text-primary-foreground"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" /> New chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {threadsLoading && Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
            {!threadsLoading && threads.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">No chats yet.</div>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition ${
                  threadId === t.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-muted-foreground"
                }`}
                onClick={() => navigate(`/assistant/${t.id}`)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-xs">{t.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this chat?")) {
                      remove(t.id);
                      if (threadId === t.id) navigate("/assistant");
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!threadId || initialMessages === null || loadingMsgs ? (
            <EmptyOrLoading loading={!!threadId && (initialMessages === null || loadingMsgs)} />
          ) : (
            <ChatWindow
              key={threadId}
              threadId={threadId}
              initialMessages={initialMessages}
              onConversationCreated={() => refresh()}
            />
          )}
        </div>
      </div>
    </AppShell>
  );

  function EmptyOrLoading({ loading }: { loading: boolean }) {
    if (loading) {
      return (
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-1/2" />
        </div>
      );
    }
    return (
      <NewChatLanding
        onCreate={async (text) => {
          // Start a brand-new chat — ChatWindow without threadId will create it
          await startNewChat(text, navigate, refresh);
        }}
      />
    );
  }
}

async function startNewChat(text: string, navigate: any, refresh: () => void) {
  // Create the conversation eagerly so the URL changes, then send first message there
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user.id, title: text.slice(0, 60) })
    .select("id").single();
  if (error || !data) {
    toast({ title: "Failed to start chat", description: error?.message, variant: "destructive" });
    return;
  }
  refresh();
  navigate(`/assistant/${data.id}?prefill=${encodeURIComponent(text)}`);
}

function NewChatLanding({ onCreate }: { onCreate: (text: string) => void }) {
  const [input, setInput] = useState("");
  const presets = [
    "Scrape lovable.dev and summarize it",
    "Search the web for top vector DBs in 2026",
    "Map firecrawl.dev and list product pages",
    "Find OpenAI's pricing page and extract the prices",
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="w-full max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-fire shadow-glow">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Firecrawl AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Powered by <span className="font-medium text-foreground">Gemini 3 Flash</span> · 3 tools wired
            (scrape, search, map) · responses persist per chat.
          </p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) onCreate(input.trim()); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything web-related…"
            className="h-12"
            autoFocus
          />
          <Button type="submit" disabled={!input.trim()} size="lg" className="bg-gradient-fire">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onCreate(p)}
              className="text-left text-xs px-3 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition"
            >{p}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  onConversationCreated,
}: {
  threadId: string;
  initialMessages: any[];
  onConversationCreated: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${SUPABASE_URL}/functions/v1/ai-assistant`,
    body: { conversationId: threadId },
    fetch: async (url, init) => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
      headers.set("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      const res = await fetch(url, { ...init, headers });
      const cid = res.headers.get("x-conversation-id");
      if (cid && cid !== threadId) onConversationCreated();
      return res;
    },
  }), [threadId, onConversationCreated]);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  // Auto-prefill from query param (when starting from landing). Guarded so it
  // fires exactly once and surfaces failures via toast instead of silently
  // leaving a blank screen.
  const prefillFiredRef = useRef(false);
  useEffect(() => {
    if (prefillFiredRef.current) return;
    const url = new URL(window.location.href);
    const prefill = url.searchParams.get("prefill");
    if (!prefill) return;
    if (messages.length > 0) { prefillFiredRef.current = true; return; }
    prefillFiredRef.current = true;
    url.searchParams.delete("prefill");
    window.history.replaceState({}, "", url.toString());
    Promise.resolve(sendMessage({ text: prefill })).catch((err: any) => {
      toast({
        title: "Couldn't start the chat",
        description: err?.message || "The assistant didn't respond. Try again.",
        variant: "destructive",
      });
    });
  }, [messages.length, sendMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isWorking = status === "streaming" || status === "submitted";

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isWorking) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <>
      <div className="border-b border-border px-4 py-3 flex items-center gap-2 bg-background/80 backdrop-blur">
        <div className="h-7 w-7 rounded-lg bg-gradient-fire flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Firecrawl AI</div>
          <div className="text-[10px] text-muted-foreground">
            Gemini 3 Flash · tools: scrape · search · map
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((m: any, i: number) => {
            const isLast = i === messages.length - 1;
            const streaming = isLast && m.role === "assistant" && isWorking;
            return <MessageRow key={m.id} message={m} streaming={streaming} />;
          })}
          {status === "submitted" && (
            <div className="text-sm text-shimmer font-medium">Thinking…</div>
          )}
          {messages.length === 0 && !isWorking && !error && (
            <div className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">
              Ready when you are. Ask anything web-related — I'll use the scrape, search, and map tools.
            </div>
          )}
          {error && (
            <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-lg p-2">
              {error.message}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={send} className="border-t border-border p-4 bg-card/50">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the assistant…"
            autoFocus
            className="h-11"
          />
          <Button type="submit" disabled={isWorking || !input.trim()} className="h-11 bg-gradient-fire">
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </>
  );
}

function MessageRow({ message, streaming }: { message: any; streaming: boolean }) {
  const isUser = message.role === "user";
  const textParts = (message.parts || []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
  const toolParts = (message.parts || []).filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-"));

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {textParts}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 animate-fade-in">
      {toolParts.map((p: any, i: number) => <ToolCard key={i} part={p} />)}
      {textParts && (
        <div className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed ${streaming ? "[&_p]:text-shimmer [&_li]:text-shimmer [&>*]:text-shimmer" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{textParts}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ToolCard({ part }: { part: any }) {
  const [open, setOpen] = useState(false);
  const name = String(part.type || "").replace(/^tool-/, "");
  const state = part.state || "input-available";
  const running = state === "input-streaming" || state === "input-available";
  const failed = state === "output-error";
  return (
    <div className="rounded-xl border border-border bg-background/60 overflow-hidden text-xs max-w-2xl">
      <button onClick={() => setOpen((s) => !s)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition text-left">
        <Wrench className={`h-3.5 w-3.5 ${failed ? "text-destructive" : "text-primary"}`} />
        <span className="font-mono">{name}</span>
        {running && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        {!running && !failed && <span className="text-[10px] text-emerald-500 ml-1">done</span>}
        {failed && <span className="text-[10px] text-destructive ml-1">error</span>}
        <ChevronDown className={`h-3 w-3 ml-auto transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
          {part.input && <pre className="text-[10px] bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(part.input, null, 2)}</pre>}
          {part.output && <pre className="text-[10px] bg-muted/40 p-2 rounded overflow-x-auto max-h-72">{JSON.stringify(part.output, null, 2)}</pre>}
          {part.errorText && <div className="text-destructive">{part.errorText}</div>}
        </div>
      )}
    </div>
  );
}