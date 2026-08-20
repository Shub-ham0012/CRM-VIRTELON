import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Microscope, Loader2, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { PageHeader, ScoreRing, ConvBadge, DemoBadge, StageBadge, EmptyState } from "@/components/shared";

export default function Research() {
  const [leads, setLeads] = useState(null);
  const nav = useNavigate();

  useEffect(() => { api.get("/leads").then((r) => setLeads(r.data)); }, []);
  if (!leads) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  const researched = leads.filter((l) => l.research_status === "Researched");
  const pending = leads.filter((l) => l.research_status !== "Researched").slice(0, 12);

  return (
    <div className="fade-up">
      <PageHeader title="Research" subtitle="AI research workspace — analyse prospects and understand their pain before outreach." />

      <h2 className="font-head text-base font-semibold mb-3 flex items-center gap-2"><Microscope className="h-4 w-4 text-violet-400" /> Researched ({researched.length})</h2>
      {researched.length === 0 ? <EmptyState icon={Microscope} title="No research yet" subtitle="Open a lead and run AI research." />
        : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {researched.map((l) => (
            <button key={l.id} data-testid="researched-card" onClick={() => nav(`/leads/${l.id}`)} className="surface rounded-lg p-4 text-left hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <ScoreRing score={l.lead_score} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><h3 className="font-head font-semibold truncate">{l.business_name}</h3>{l.is_demo && <DemoBadge />}</div>
                  <div className="text-xs text-zinc-500">{l.location} · {l.category}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2"><ConvBadge level={l.conversion_score} /><StageBadge stage={l.pipeline_status} /></div>
                <ArrowRight className="h-4 w-4 text-zinc-600" />
              </div>
            </button>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 className="font-head text-base font-semibold mb-3 text-zinc-400">Awaiting Research</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {pending.map((l) => (
              <button key={l.id} onClick={() => nav(`/leads/${l.id}`)} className="rounded-md hairline p-3 text-left hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-1.5 text-sm text-zinc-200 truncate">{l.business_name}{l.is_demo && <DemoBadge />}</div>
                <div className="text-xs text-zinc-500">{l.location}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
