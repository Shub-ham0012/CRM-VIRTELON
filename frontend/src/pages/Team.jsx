import { useEffect, useState } from "react";
import { Loader2, Users, CheckSquare, CalendarClock, CalendarDays, FolderKanban, Trophy } from "lucide-react";
import api from "@/lib/api";
import { PageHeader, initialsFrom } from "@/components/shared";

const STAT_META = [
  ["leads", "Leads", Users], ["tasks_open", "Open Tasks", CheckSquare],
  ["followups", "Follow-ups", CalendarClock], ["meetings", "Meetings", CalendarDays],
  ["projects", "Projects", FolderKanban], ["won", "Won", Trophy],
];

export default function Team() {
  const [team, setTeam] = useState(null);
  useEffect(() => { api.get("/team").then((r) => setTeam(r.data)); }, []);
  if (!team) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Team" subtitle="Founder workload and live operational stats." />
      <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Stats are live counts from your data (not fabricated).
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {team.map((u) => (
          <div key={u.id} data-testid="team-card" className="surface rounded-lg p-5">
            <div className="flex items-center gap-3">
              {u.avatar ? <img src={u.avatar} className="h-14 w-14 rounded-full object-cover ring-1 ring-white/10" alt="" />
                : <div className="h-14 w-14 rounded-full bg-zinc-800 grid place-items-center text-lg font-head">{initialsFrom(u.name)}</div>}
              <div>
                <h3 className="font-head font-semibold text-white">{u.name}</h3>
                <div className="text-xs text-zinc-500">{u.email}</div>
                <span className="mt-1 inline-block rounded bg-[#2563eb]/15 px-1.5 py-0.5 text-[10px] font-mono uppercase text-[#3b82f6]">{u.role}</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {STAT_META.map(([key, label, Icon]) => (
                <div key={key} className="rounded-md hairline p-3 text-center">
                  <Icon className="h-4 w-4 mx-auto text-zinc-500 mb-1" />
                  <div className="kpi-value text-lg text-white">{u.stats[key]}</div>
                  <div className="text-[10px] text-zinc-600">{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
