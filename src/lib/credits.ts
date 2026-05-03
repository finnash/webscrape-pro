export const TOTAL_CREDITS = 83000;

export const estimateScrapeCost = (formats: string[]) => {
  let c = 1;
  if (formats.includes("screenshot")) c += 1;
  if (formats.some((f) => f === "json" || f === "summary")) c += 5;
  return c;
};

export const lifetimeEstimates = () => ({
  simpleScrapes: TOTAL_CREDITS,
  llmScrapes: Math.floor(TOTAL_CREDITS / 6),
  searchResults: TOTAL_CREDITS,
  browserHours: Math.floor(TOTAL_CREDITS / 60),
});