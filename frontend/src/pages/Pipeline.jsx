import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader, STAGE_COLORS, PIPELINE_STAGES, ConvBadge, DemoBadge } from "@/components/shared";

export default function Pipeline() {
  const [leads, setLeads] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const nav = useNavigate();

  const load = () => api.get("/leads").then((r) => setLeads(r.data));
  useEffect(() => { load(); }, []);

  const onDrop = async (stage) => {
    setOverStage(null);
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    if (!lead || lead.pipeline_status === stage) { setDragId(null); return; }
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, pipeline_status: stage } : l)));
    setDragId(null);
    try { await api.patch(`/leads/${dragId}/stage`, { pipeline_status: stage }); }
    catch { toast.error("Update failed"); load(); }
  };

  if (!leads) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Lead Pipeline" subtitle="Drag leads across stages to update their status." />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const items = leads.filter((l) => l.pipeline_status === stage);
          const color = STAGE_COLORS[stage];
          return (
            <div key={stage} data-testid={`kanban-col-${stage}`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage(null)}
              onDrop={() => onDrop(stage)}
              className={`w-72 shrink-0 rounded-lg transition-colors ${overStage === stage ? "bg-white/[0.04]" : ""}`}>
              <div className="flex items-center justify-between px-3 py-2 sticky top-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-xs uppercase tracking-wide" style={{ color }}>{stage}</span>
                </div>
                <span className="text-xs text-zinc-600 font-mono">{items.length}</span>
              </div>
              <div className="space-y-2 px-1 min-h-[120px]">
                {items.map((l) => (
                  <div key={l.id} draggable data-testid="kanban-card"
                    onDragStart={() => setDragId(l.id)}
                    onClick={() => nav(`/leads/${l.id}`)}
                    className="surface rounded-md p-3 cursor-grab active:cursor-grabbing hover:bg-white/[0.03] transition-colors"
                    style={{ borderLeft: `2px solid ${color}` }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-zinc-100 font-medium truncate">{l.business_name}</span>
                      {l.is_demo && <DemoBadge />}
                    </div>
                    <div className="text-[11px] text-zinc-500 mb-2">{l.location} · {l.category}</div>
                    <div className="flex items-center justify-between">
                      <ConvBadge level={l.conversion_score} />
                      <span className="font-mono text-xs text-zinc-400">{l.lead_score}</span>
                    </div>
                    {l.next_follow_up && <div className="mt-2 text-[10px] font-mono text-orange-400/80">↳ {l.next_follow_up.slice(0, 10)}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
