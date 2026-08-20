import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, BadgeCheck, Send, CalendarClock, CalendarDays,
  Building2, FolderKanban, TrendingUp, Trophy, ArrowUpRight, Microscope, Loader2,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell } from "recharts";
import api, { inr } from "@/lib/api";
import { StageBadge, DemoBadge, ScoreRing, STAGE_COLORS, ConvBadge } from "@/components/shared";

const KPIS = [
  { key: "total_leads", label: "Total Leads", icon: Users },
  { key: "new_leads", label: "New Leads", icon: UserPlus },
  { key: "qualified", label: "Qualified", icon: BadgeCheck },
  { key: "pitched", label: "Pitched", icon: Send },
  { key: "followups_due", label: "Follow-ups Due", icon: CalendarClock },
  { key: "meetings", label: "Meetings", icon: CalendarDays },
  { key: "active_clients", label: "Active Clients", icon: Building2 },
  { key: "active_projects", label: "Active Projects", icon: FolderKanban },
  { key: "pipeline_value", label: "Pipeline Value", icon: TrendingUp, money: true },
  { key: "won_revenue", label: "Won Revenue", icon: Trophy, money: true },
];

function Card({ children, className = "", testid }) {
  return <div data-testid={testid} className={`surface rounded-lg p-5 ${className}`}>{children}</div>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const nav = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)); }, []);

  if (!data)
    return <div className="grid place-items-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  const { kpis, pipeline_dist, campaign_performance, followups_due, followups_upcoming = [], today, recent_research, active_projects, activities, workload } = data;

  return (
    <div className="fade-up space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-head text-2xl font-semibold">Command Centre</h1>
          <p className="mt-1 text-sm text-zinc-500">Your leads, research, campaigns and operations at a glance.</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPIS.map((k, i) => (
          <div key={k.key} data-testid={`kpi-${k.key}`}
            className="surface rounded-lg p-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between">
              <k.icon className="h-4 w-4 text-zinc-500" />
              {k.key === "followups_due" && kpis[k.key] > 0 && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
            </div>
            <div className="mt-3 kpi-value text-2xl font-semibold text-white">
              {k.money ? inr(kpis[k.key]) : kpis[k.key]}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pipeline visualization */}
        <Card className="lg:col-span-2" testid="dash-pipeline">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-base font-semibold">Lead Pipeline</h2>
            <button onClick={() => nav("/pipeline")} className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1">
              Open board <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipeline_dist} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 9, fill: "#71717a", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#161618", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {pipeline_dist.map((e) => <Cell key={e.stage} fill={STAGE_COLORS[e.stage]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Follow-ups due today */}
        <Card testid="dash-followups">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-4 w-4 text-orange-400" />
            <h2 className="font-head text-base font-semibold">Follow-ups Due</h2>
          </div>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {followups_due.length === 0 && <p className="text-sm text-zinc-600">Nothing due. Clear runway.</p>}
            {followups_due.map((l) => {
              const overdue = l.next_follow_up && l.next_follow_up.slice(0, 10) < today;
              return (
                <button key={l.id} onClick={() => nav(`/leads/${l.id}`)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 hover:bg-white/5 text-left">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 truncate flex items-center gap-1.5">
                      {l.business_name}{l.is_demo && <DemoBadge />}
                      {overdue && <span className="rounded bg-red-500/15 text-red-400 text-[9px] font-mono px-1.5 py-0.5 border border-red-500/25">OVERDUE</span>}
                    </div>
                    <div className={`text-[11px] ${overdue ? "text-red-400/80" : "text-zinc-500"}`}>{l.location} · {l.next_follow_up?.slice(0, 10)}</div>
                  </div>
                  <StageBadge stage={l.pipeline_status} />
                </button>
              );
            })}
          </div>
          {followups_upcoming.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/8">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1.5">Upcoming (7 days)</div>
              <div className="space-y-1 max-h-[110px] overflow-y-auto">
                {followups_upcoming.map((l) => (
                  <button key={l.id} onClick={() => nav(`/leads/${l.id}`)} className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-white/5 text-left">
                    <span className="text-xs text-zinc-300 truncate">{l.business_name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{l.next_follow_up?.slice(0, 10)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Campaign performance */}
        <Card className="lg:col-span-2" testid="dash-campaigns">
          <h2 className="font-head text-base font-semibold mb-4">Campaign Performance</h2>
          <div className="space-y-3">
            {campaign_performance.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-44 truncate text-sm text-zinc-300">{c.name}</div>
                <div className="flex-1 flex items-center gap-1 h-5">
                  {[["Leads", c.total, "#3b82f6"], ["Qualified", c.qualified, "#10b981"], ["Pitched", c.pitched, "#f59e0b"], ["Won", c.won, "#22c55e"]].map(([lbl, v, col]) => (
                    <div key={lbl} className="flex items-center gap-1" title={`${lbl}: ${v}`}>
                      <span className="h-2 w-2 rounded-sm" style={{ background: col }} />
                      <span className="text-xs font-mono text-zinc-400">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card testid="dash-activity">
          <h2 className="font-head text-base font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {activities.map((a) => (
              <div key={a.id} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#3b82f6] shrink-0" />
                <div>
                  <div className="text-sm text-zinc-300 leading-snug">{a.text}</div>
                  <div className="text-[11px] text-zinc-600">{a.actor}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recently researched */}
        <Card className="lg:col-span-2" testid="dash-research">
          <div className="flex items-center gap-2 mb-4">
            <Microscope className="h-4 w-4 text-violet-400" />
            <h2 className="font-head text-base font-semibold">Recently Researched Leads</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {recent_research.map((l) => (
              <button key={l.id} onClick={() => nav(`/leads/${l.id}`)}
                className="flex items-center gap-3 rounded-md p-3 hairline hover:bg-white/5 text-left">
                <ScoreRing score={l.lead_score} />
                <div className="min-w-0">
                  <div className="text-sm text-zinc-200 truncate flex items-center gap-1.5">{l.business_name}{l.is_demo && <DemoBadge />}</div>
                  <div className="mt-0.5"><ConvBadge level={l.conversion_score} /></div>
                </div>
              </button>
            ))}
            {recent_research.length === 0 && <p className="text-sm text-zinc-600">No researched leads yet.</p>}
          </div>
        </Card>

        {/* Team workload */}
        <Card testid="dash-workload">
          <h2 className="font-head text-base font-semibold mb-4">Team Workload</h2>
          <div className="space-y-3">
            {workload.map((w) => (
              <div key={w.name} className="flex items-center gap-3">
                {w.avatar ? <img src={w.avatar} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" alt="" />
                  : <div className="h-8 w-8 rounded-full bg-zinc-800 grid place-items-center text-xs">{w.initials}</div>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{w.name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">{w.leads} leads · {w.projects} projects</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active projects */}
      <Card testid="dash-projects">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-base font-semibold">Active Projects</h2>
          <button onClick={() => nav("/projects")} className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {active_projects.map((p) => (
            <button key={p.id} onClick={() => nav(`/projects/${p.id}`)} className="rounded-md p-3 hairline hover:bg-white/5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#3b82f6]">{p.status}</span>
                {p.is_demo && <DemoBadge />}
              </div>
              <div className="mt-1.5 text-sm text-zinc-200 truncate">{p.name}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{p.client_name} · {inr(p.value)}</div>
            </button>
          ))}
          {active_projects.length === 0 && <p className="text-sm text-zinc-600">No active projects.</p>}
        </div>
      </Card>
    </div>
  );
}
