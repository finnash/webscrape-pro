import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Search, Map as MapIcon, Layers, Sparkles, FileText, Monitor, Zap, Radar } from "lucide-react";
import { lifetimeEstimates, TOTAL_CREDITS } from "@/lib/credits";

const cards = [
  { to: "/scrape", icon: Globe, title: "Scrape", desc: "Extract clean markdown, HTML, links and screenshots from any URL.", ready: true },
  { to: "/search", icon: Search, title: "Search", desc: "Web search with optional content scraping of every result.", ready: true },
  { to: "/monitor", icon: Radar, title: "Monitor", desc: "Watch any page on a schedule. Get Discord pings the moment it changes.", ready: true },
  { to: "/map", icon: MapIcon, title: "Map", desc: "Discover every URL on a website in seconds." },
  { to: "/crawl", icon: Layers, title: "Crawl", desc: "Recursively scrape entire sites with smart depth controls." },
  { to: "/extract", icon: Sparkles, title: "Extract", desc: "LLM-powered structured data extraction with schemas." },
  { to: "/parse", icon: FileText, title: "Parse PDF", desc: "Turn PDFs and documents into clean structured text." },
  { to: "/browser", icon: Monitor, title: "Browser", desc: "Live view of every browser session the platform spins up.", ready: true },
];

export default function Home() {
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const est = lifetimeEstimates();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    nav(`/scrape${url ? `?url=${encodeURIComponent(url)}` : ""}`);
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-10">
          <div className="flex justify-center mb-6"><Logo size={44} /></div>
          <h1 className="text-center text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
            Watch the web. <span className="text-gradient-fire">Pounce on what changes.</span>
          </h1>
          <p className="text-center text-muted-foreground max-w-xl mx-auto mb-8 sm:text-lg">
            Meow Scraper turns any URL into clean data, monitors the pages you care about, and pings your Discord the second anything moves.
          </p>

          <form onSubmit={go} className="mx-auto max-w-2xl">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card shadow-elegant p-2 pl-4 focus-within:ring-2 focus-within:ring-primary/40 transition">
              <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a URL — e.g. https://lovable.dev"
                className="border-0 shadow-none focus-visible:ring-0 text-base h-11 bg-transparent"
              />
              <Button type="submit" className="h-11 px-5 bg-gradient-fire text-primary-foreground hover:opacity-95 rounded-xl">
                Scrape <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-center">
              ~1 credit per page · {TOTAL_CREDITS.toLocaleString()} credits in your account
            </p>
          </form>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Zap} label="Simple scrapes" value={`~${est.simpleScrapes.toLocaleString()}`} />
            <StatCard icon={Sparkles} label="AI extracts" value={`~${est.llmScrapes.toLocaleString()}`} />
            <StatCard icon={Search} label="Search results" value={`~${est.searchResults.toLocaleString()}`} />
            <StatCard icon={Monitor} label="Browser hours" value={`~${est.browserHours.toLocaleString()}h`} />
          </div>

          <div className="mt-14">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">All endpoints</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map((c) => (
                <Link key={c.to} to={c.to} className="group rounded-xl border border-border bg-card p-5 hover:shadow-elegant hover:border-primary/40 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-gradient-fire/10 flex items-center justify-center text-primary">
                      <c.icon className="h-4.5 w-4.5" />
                    </div>
                    {c.ready ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Ready</span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Soon</span>
                    )}
                  </div>
                  <div className="font-semibold mb-1">{c.title}</div>
                  <div className="text-sm text-muted-foreground">{c.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="text-xl font-semibold tracking-tight">{value}</div>
  </div>
);