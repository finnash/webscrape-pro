import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLANS, planBySlug, priceFor, BillingCycle } from "@/lib/plans";
import { useProfile } from "@/hooks/useProfile";
import { Check, Mail, Sparkles } from "lucide-react";

export default function Settings() {
  const { profile } = useProfile();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const current = planBySlug(profile?.plan ?? "free");

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Plans & Billing</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You're on the <span className="font-medium text-foreground">{current.name}</span> plan ·
              {" "}{profile?.credits_remaining ?? 0} / {profile?.daily_credit_limit ?? 0} credits left today
            </p>
          </div>
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly <Badge variant="secondary" className="ml-2 text-[10px]">save ~17%</Badge></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = p.slug === current.slug;
            const price = priceFor(p, cycle);
            return (
              <div key={p.slug}
                className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                  p.highlight ? "border-primary/60 shadow-elegant" : "border-border"
                }`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-gradient-fire text-primary-foreground px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </div>
                )}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">${price}</span>
                    <span className="text-sm text-muted-foreground">/{cycle === "yearly" ? "yr" : "mo"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.dailyCredits.toLocaleString()} credits / day
                  </div>
                </div>
                <ul className="space-y-2 text-sm mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">Your current plan</Button>
                ) : p.slug === "free" ? (
                  <Button variant="outline" disabled className="w-full">Downgrade — contact us</Button>
                ) : (
                  <a href="mailto:hello@meowscraper.app?subject=Upgrade%20to%20Meow%20Scraper">
                    <Button className={`w-full ${p.highlight ? "bg-gradient-fire text-primary-foreground" : ""}`}>
                      <Mail className="h-4 w-4 mr-1.5" /> Contact us to upgrade
                    </Button>
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Payments coming soon. For now, ping us and we'll switch your plan in under an hour.
        </p>
      </div>
    </AppShell>
  );
}