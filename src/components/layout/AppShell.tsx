import { ReactNode } from "react";
import { NavLink, Navigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Globe, Search, Map as MapIcon, Layers, Sparkles,
  FileText, Monitor, ListChecks, Settings, Moon, Sun, LogOut,
} from "lucide-react";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/scrape", label: "Scrape", icon: Globe, ready: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/crawl", label: "Crawl", icon: Layers },
  { to: "/extract", label: "Extract", icon: Sparkles },
  { to: "/parse", label: "Parse PDF", icon: FileText },
  { to: "/browser", label: "Browser", icon: Monitor },
  { to: "/jobs", label: "Jobs", icon: ListChecks },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {!n.ready && n.to !== "/" && n.to !== "/jobs" && (
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">soon</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          <NavLink to="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60">
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 truncate text-xs text-muted-foreground">{user.email}</div>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="h-7 w-7">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className="h-7 w-7">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-background/80 backdrop-blur sticky top-0 z-10">
          <Logo size={24} />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
        <nav className="md:hidden flex items-center justify-around border-t border-border bg-background py-2">
          {nav.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/jobs" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <ListChecks className="h-4 w-4" /> Jobs
          </NavLink>
        </nav>
      </div>
    </div>
  );
};