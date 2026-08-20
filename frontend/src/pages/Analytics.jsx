import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Users, Building2, FolderKanban, Trophy } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import api, { inr } from "@/lib/api";
import { PageHeader } from "@/components/shared";

const COLORS = ["#2563eb", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1", "#eab308", "#ef4444"];
const CONV_COLORS = { HIGH: "#22c55e", MEDIUM: "#f59e0b", LOW: "#71717a" };

function Card({ title, children }) {
  return <div className="surface rounded-lg p-5"><h2 className="font-head text-base font-semibold mb-4">{title}</h2>{children}</div>;
}

export default function Analytics() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/analytics").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  const TOTALS = [
    ["Total Leads", d.totals.leads, Users], ["Clients", d.totals.clients, Building2],
    ["Projects", d.totals.projects, FolderKanban], ["Pipeline Value", inr(d.totals.pipeline_value), TrendingUp],
    ["Won Revenue", inr(d.totals.won_revenue), Trophy],
  ];

  return (
    <div className="fade-up space-y-6">
      <PageHeader title="Analytics" subtitle="Performance across leads, pipeline and revenue." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TOTALS.map(([label, val, Icon]) => (
          <div key={label} className="surface rounded-lg p-4">
            <Icon className="h-4 w-4 text-zinc-500" />
            <div className="mt-3 kpi-value text-2xl text-white">{val}</div>
            <div className="text-[11px] text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Conversion Funnel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.funnel} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "#a1a1aa", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#161618", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>{d.funnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Leads by Conversion Potential">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.by_conversion} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {d.by_conversion.map((e) => <Cell key={e.name} fill={CONV_COLORS[e.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#161618", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {d.by_conversion.map((e) => <div key={e.name} className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: CONV_COLORS[e.name] }} /><span className="text-zinc-400">{e.name} ({e.value})</span></div>)}
          </div>
        </Card>

        <Card title="Leads by Category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.by_category} margin={{ top: 4, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={60} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#161618", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Leads by Location">
          <div className="space-y-2 pt-2">
            {d.by_location.slice(0, 8).map((l, i) => {
              const max = d.by_location[0]?.value || 1;
              return (
                <div key={l.name} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-zinc-400 truncate">{l.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(l.value / max) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                  <span className="font-mono text-xs text-zinc-400 w-6 text-right">{l.value}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
