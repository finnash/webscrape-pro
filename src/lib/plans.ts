export type PlanSlug = "free" | "pro" | "premium";
export type BillingCycle = "monthly" | "yearly";

export type Plan = {
  slug: PlanSlug;
  name: string;
  tagline: string;
  dailyCredits: number;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    slug: "free",
    name: "Free Kitten",
    tagline: "Get a feel for Meow Scraper",
    dailyCredits: 30,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "30 daily scrape credits (resets every 24h)",
      "Scrape · Search · Map · Parse PDF",
      "Markdown + screenshot output",
      "5 active monitors",
      "Community support",
    ],
  },
  {
    slug: "pro",
    name: "Prowler",
    tagline: "For solo operators who ship daily",
    dailyCredits: 1000,
    priceMonthly: 29,
    priceYearly: 290,
    highlight: true,
    features: [
      "1,000 daily credits",
      "Everything in Free, plus:",
      "Crawl entire sites + Extract (LLM schemas)",
      "Agentic snapshots (auto Freedium/archive.ph cascade)",
      "Unlimited monitors with Discord webhook delivery",
      "Full job logs, request/response inspector",
      "Priority Firecrawl queue",
    ],
  },
  {
    slug: "premium",
    name: "Apex Panther",
    tagline: "For teams running the whole web",
    dailyCredits: 5000,
    priceMonthly: 149,
    priceYearly: 999,
    features: [
      "5,000 daily credits",
      "Everything in Prowler, plus:",
      "Agentic RAG search across your snapshots",
      "Browser sessions + live screencast",
      "Custom scheduling & webhook callbacks",
      "Bring-your-own Discord/Telegram bots",
      "White-glove onboarding · 1:1 Slack channel",
    ],
  },
];

export const planBySlug = (slug: string): Plan =>
  PLANS.find((p) => p.slug === slug) ?? PLANS[0];

export const priceFor = (p: Plan, cycle: BillingCycle) =>
  cycle === "yearly" ? p.priceYearly : p.priceMonthly;