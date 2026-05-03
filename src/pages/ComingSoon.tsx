import { AppShell } from "@/components/layout/AppShell";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-fire flex items-center justify-center mb-5 shadow-glow">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-left text-sm text-muted-foreground mb-8">
          <div className="font-medium text-foreground mb-2">Coming next</div>
          We&apos;re shipping <strong className="text-foreground">Scrape</strong> first with full polish — every format, every download, every detail. This endpoint lands right after, with the same quality bar.
        </div>
        <Button asChild variant="outline"><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back to home</Link></Button>
      </div>
    </AppShell>
  );
}