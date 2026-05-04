export const TOTAL_CREDITS = 83000;

export const estimateScrapeCost = (formats: string[]) => {
  let c = 1;
  if (formats.includes("screenshot")) c += 1;
  if (formats.some((f) => f === "json" || f === "summary")) c += 5;
  return c;
};

// Search: 1 credit per result returned. If we also scrape each result,
// add ~1 credit per page (more if richer formats are picked).
export const estimateSearchCost = (limit: number, scrapeResults: boolean, formats: string[] = []) => {
  const base = Math.max(1, limit);
  if (!scrapeResults) return base;
  const perPage = estimateScrapeCost(formats.length ? formats : ["markdown"]);
  return base + base * perPage;
};

export const lifetimeEstimates = () => ({
  simpleScrapes: TOTAL_CREDITS,
  llmScrapes: Math.floor(TOTAL_CREDITS / 6),
  searchResults: TOTAL_CREDITS,
  browserHours: Math.floor(TOTAL_CREDITS / 60),
});