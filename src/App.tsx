import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Scrape from "./pages/Scrape";
import Jobs from "./pages/Jobs";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Home />} />
              <Route path="/scrape" element={<Scrape />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/search" element={<ComingSoon title="Search" description="Web search with optional content scraping of every result." />} />
              <Route path="/map" element={<ComingSoon title="Map" description="Discover every URL on a website in seconds." />} />
              <Route path="/crawl" element={<ComingSoon title="Crawl" description="Recursively scrape entire sites with smart depth controls." />} />
              <Route path="/extract" element={<ComingSoon title="Extract" description="LLM-powered structured data extraction with schemas." />} />
              <Route path="/parse" element={<ComingSoon title="Parse PDF" description="Turn PDFs and documents into clean structured text." />} />
              <Route path="/browser" element={<ComingSoon title="Browser" description="Interactive browser sessions for stubborn JS-heavy sites." />} />
              <Route path="/settings" element={<ComingSoon title="Settings" description="Account preferences and API key management." />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
