import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Globe, Search, Sparkles, Monitor, Zap, Radar, Bell, Command,
  CheckCircle2, Activity,
} from "lucide-react";
import { lifetimeEstimates, TOTAL_CREDITS } from "@/lib/credits";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"scrape" | "monitor" | "extract">("scrape");
  const est = lifetimeEstimates();
  const { user } = useAuth();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const path = mode === "scrape" ? "/scrape" : mode === "monitor" ? "/monitor" : "/extract";
    nav(`${path}${url ? `?url=${encodeURIComponent(url)}` : ""}`);
  };

  return (
    <AppShell>
      <div className="relative min-h-full">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

        {/* Top bar */}
        <header className="relative hidden md:flex items-center gap-4 px-8 py-5 border-b border-border/60">
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-xl flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm text-muted-foreground">
              <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium">
                <Command className="h-3 w-3" /> K
              </kbd>
              <span>Quick search or jump to…</span>
            </div>
          </div>
          <button className="relative h-9 w-9 rounded-full border border-border bg-card/60 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </button>
          <div className="h-9 w-9 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-sm font-semibold text-primary">
            {(user?.email?.[0] || "A").toUpperCase()}
          </div>
        </header>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-14 pb-12">
          {/* Hero */}
          <div className="relative">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
                Watch the web.
                <br />
                <span className="text-gradient-fire">Pounce</span>{" "}
                <span className="text-foreground">on what changes.</span>
              </h1>
              <p className="mt-5 text-muted-foreground sm:text-lg max-w-lg">
                Turn any URL into clean data, monitor what matters, and get notified the moment something moves.
              </p>
            </div>
            <CatMark className="hidden md:block absolute -top-4 right-0 w-[300px]" />
          </div>

          {/* Command bar */}
          <form onSubmit={go} className="mt-10">
            <div className="rounded-2xl border border-border bg-card shadow-elegant p-3 focus-within:ring-2 focus-within:ring-primary/40 transition">
              <div className="flex items-center gap-2 pl-3">
                <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a URL to scrape, monitor or extract…"
                  className="border-0 shadow-none focus-visible:ring-0 text-base h-12 bg-transparent"
                />
                <Button type="submit" className="h-12 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90">
                  Start <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1 px-2 pt-2">
                <ModeTab icon={Zap} label="Scrape" active={mode === "scrape"} onClick={() => setMode("scrape")} />
                <ModeTab icon={Activity} label="Monitor" active={mode === "monitor"} onClick={() => setMode("monitor")} />
                <ModeTab icon={Sparkles} label="Extract" active={mode === "extract"} onClick={() => setMode("extract")} />
              </div>
            </div>
          </form>

          {/* Stat cards */}
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Zap} label="Scrapes" value={est.simpleScrapes.toLocaleString()} delta="12.4%" tint="primary" sparkColor="hsl(var(--primary))" />
            <StatCard icon={Sparkles} label="AI Extracts" value={est.llmScrapes.toLocaleString()} delta="18.7%" tint="violet" sparkColor="#a78bfa" />
            <StatCard icon={Search} label="Searches" value={est.searchResults.toLocaleString()} delta="8.1%" tint="amber" sparkColor="#f59e0b" />
            <StatCard icon={Monitor} label="Browser Hours" value={`${est.browserHours.toLocaleString()}h`} delta="6.3%" tint="blue" sparkColor="#3b82f6" />
          </div>

          {/* Status footer */}
          <div className="mt-6 rounded-xl border border-border bg-card/60 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-muted-foreground">All systems operational</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-muted-foreground">
              <span>Your last run:</span>
              <span className="text-foreground font-medium">example.com scrape</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-xs px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </span>
              <span className="text-xs">2m ago</span>
              <Link to="/jobs" className="text-foreground hover:text-primary"><ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            ~1 credit per page · {TOTAL_CREDITS.toLocaleString()} credits in your account
          </p>
        </div>
      </div>
    </AppShell>
  );
}

const ModeTab = ({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
    }`}
  >
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);

const tintMap: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  violet: "bg-violet-500/15 text-violet-400",
  amber: "bg-amber-500/15 text-amber-400",
  blue: "bg-blue-500/15 text-blue-400",
};

const StatCard = ({
  icon: Icon, label, value, delta, tint, sparkColor,
}: { icon: any; label: string; value: string; delta: string; tint: string; sparkColor: string }) => (
  <div className="rounded-2xl border border-border bg-card p-5 hover:shadow-elegant transition">
    <div className="flex items-center justify-between mb-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tintMap[tint]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div className="text-3xl font-semibold tracking-tight">{value}</div>
    <div className="mt-2 flex items-center gap-1.5 text-xs">
      <span className="text-primary font-medium">↑ {delta}</span>
      <span className="text-muted-foreground">vs last 7 days</span>
    </div>
    <Sparkline color={sparkColor} className="mt-3 w-full h-10" />
  </div>
);

const Sparkline = ({ color, className }: { color: string; className?: string }) => {
  const pts = [12, 14, 10, 16, 13, 18, 15, 20, 17, 22, 19, 24];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const w = 120;
  const h = 32;
  const step = w / (pts.length - 1);
  const path = pts
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const CatMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 320 200" className={className} aria-hidden>
    <g fill="hsl(var(--foreground))">
      <ellipse cx="160" cy="115" rx="78" ry="38" />
      <circle cx="105" cy="95" r="32" />
      <polygon points="82,72 92,95 108,80" />
      <polygon points="128,72 118,95 102,80" />
      <ellipse cx="225" cy="105" rx="22" ry="14" transform="rotate(20 225 105)" />
      <rect x="195" y="148" width="6" height="22" rx="3" />
      <rect x="215" y="148" width="6" height="22" rx="3" />
    </g>
    <g fill="hsl(var(--background))">
      <circle cx="98" cy="92" r="4" />
      <circle cx="116" cy="92" r="4" />
    </g>
    <path d="M245 110 Q280 120 270 150 Q258 180 295 175" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinecap="round" />
    <text x="260" y="195" fill="hsl(var(--primary))" fontFamily="cursive" fontSize="22" fontStyle="italic">meow</text>
  </svg>
);