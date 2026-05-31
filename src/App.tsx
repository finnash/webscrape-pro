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
import SearchPage from "./pages/Search";
import BrowserSessions from "./pages/Browser";
import Jobs from "./pages/Jobs";
import MapPage from "./pages/Map";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";
import Assistant from "./pages/Assistant";
import Snapshots from "./pages/Snapshots";
import Crawl from "./pages/Crawl";
import Extract from "./pages/Extract";
import ParsePdf from "./pages/ParsePdf";
import MonitorPage from "./pages/Monitor";

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
            <Route path="/search" element={<SearchPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/crawl" element={<Crawl />} />
              <Route path="/extract" element={<Extract />} />
              <Route path="/parse" element={<ParsePdf />} />
              <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/browser" element={<BrowserSessions />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/assistant/:threadId" element={<Assistant />} />
              <Route path="/snapshots" element={<Snapshots />} />
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
