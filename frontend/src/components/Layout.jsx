import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Search, Users, Microscope, Megaphone, KanbanSquare,
  Building2, FolderKanban, CheckSquare, UsersRound, FileText, BarChart3,
  Settings as SettingsIcon, Plus, LogOut, ChevronDown, Command, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { initialsFrom, StageBadge } from "@/components/shared";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/finder", label: "Lead Finder", icon: Search },
  { to: "/leads", label: "All Leads", icon: Users },
  { to: "/research", label: "Research", icon: Microscope },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const QUICK = [
  { label: "Find Leads", to: "/finder" },
  { label: "Research Lead", to: "/leads" },
  { label: "Create Campaign", to: "/campaigns?new=1" },
  { label: "Add Client", to: "/clients?new=1" },
  { label: "Add Project", to: "/projects?new=1" },
];

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef();

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data); setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (path) => { setQ(""); setOpen(false); nav(path); };
  const groups = results
    ? [
        ["Leads", results.leads, (r) => go(`/leads/${r.id}`)],
        ["Clients", results.clients, (r) => go(`/clients`)],
        ["Projects", results.projects, (r) => go(`/projects/${r.id}`)],
        ["Campaigns", results.campaigns, (r) => go(`/campaigns/${r.id}`)],
      ].filter(([, arr]) => arr && arr.length)
    : [];

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="flex items-center gap-2 rounded-md bg-black/30 hairline px-3 h-9">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          data-testid="global-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search leads, clients, projects…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
        />
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-zinc-600 font-mono">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>
      {open && groups.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-md surface-2 hairline shadow-2xl overflow-hidden">
          {groups.map(([label, arr, onClick]) => (
            <div key={label} className="py-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-mono">{label}</div>
              {arr.map((r) => (
                <button key={r.id} onClick={() => onClick(r)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-white/5 text-left">
                  <span className="text-zinc-200">{r.business_name || r.company || r.name}</span>
                  {r.pipeline_status && <StageBadge stage={r.pipeline_status} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to) && n.to !== "/"))?.label
    || (loc.pathname === "/" ? "Dashboard" : "");

  return (
    <div className="min-h-screen grain">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#0b0b0d] border-r border-white/8">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/8">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2563eb]">
            <Zap className="h-4 w-4 text-white" fill="white" />
          </div>
          <div className="leading-tight">
            <div className="font-head text-sm font-semibold text-white">VIRTELON</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Command Centre</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                cn("nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  isActive ? "bg-[#2563eb]/12 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200")
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-[#3b82f6]")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Internal build · v1.0
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 h-16 px-6 bg-[#09090b]/85 backdrop-blur border-b border-white/8">
          <div className="text-sm text-zinc-500 font-mono hidden md:block min-w-[90px]">{current}</div>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="quick-actions-btn"
                  className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium text-white transition-colors">
                  <Plus className="h-4 w-4" /> Quick
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="surface-2 border-white/10 w-48">
                {QUICK.map((a) => (
                  <DropdownMenuItem key={a.label} data-testid={`quick-${a.label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => nav(a.to)} className="cursor-pointer text-zinc-300 focus:bg-white/5 focus:text-white">
                    <Plus className="h-3.5 w-3.5 mr-2 text-[#3b82f6]" /> {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-btn" className="flex items-center gap-2">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800 grid place-items-center text-xs font-medium">
                      {initialsFrom(user?.name || "U")}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="surface-2 border-white/10 w-52">
                <div className="px-2 py-2">
                  <div className="text-sm font-medium text-white">{user?.name}</div>
                  <div className="text-xs text-zinc-500">{user?.email}</div>
                  <div className="mt-1 inline-block rounded bg-[#2563eb]/15 px-1.5 py-0.5 text-[10px] font-mono uppercase text-[#3b82f6]">{user?.role}</div>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem data-testid="logout-btn" onClick={logout} className="cursor-pointer text-zinc-300 focus:bg-white/5 focus:text-white">
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="relative z-10 p-6 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
