import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { StageBadge, ConvBadge, DemoBadge } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [allLeads, setAllLeads] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get(`/campaigns/${id}`); setC(data); }, [id]);
  useEffect(() => { load(); api.get("/leads").then((r) => setAllLeads(r.data)); }, [load]);

  const addLead = async (leadId) => { await api.post(`/campaigns/${id}/leads`, { lead_ids: [leadId] }); toast.success("Lead added"); load(); };
  const removeLead = async (leadId) => { await api.delete(`/campaigns/${id}/leads/${leadId}`); toast.success("Removed"); load(); };

  if (!c) return <div className="grid place-items-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;
  const available = allLeads.filter((l) => l.campaign_id !== id);

  const STATS = [
    ["Total Leads", c.stats.total], ["Researched", c.stats.researched], ["Qualified", c.stats.qualified],
    ["Pitched", c.stats.pitched], ["Replies", c.stats.replies], ["Meetings", c.stats.meetings],
    ["Proposals", c.stats.proposals], ["Won", c.stats.won],
  ];

  return (
    <div className="fade-up">
      <button onClick={() => nav("/campaigns")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-4"><ArrowLeft className="h-4 w-4" /> Campaigns</button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2"><h1 className="font-head text-2xl font-semibold">{c.name}</h1>{c.is_demo && <DemoBadge />}</div>
          <p className="mt-1 text-sm text-zinc-500">{c.industry} · {c.location} · {c.offer}</p>
        </div>
        <div className="text-right"><div className="font-mono text-2xl text-emerald-400">{c.stats.conversion_rate}%</div><div className="text-xs text-zinc-600">conversion</div></div>
      </div>

      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {STATS.map(([l, v]) => (
          <div key={l} className="surface rounded-lg p-3 text-center">
            <div className="kpi-value text-xl text-white">{v}</div>
            <div className="text-[10px] text-zinc-600 uppercase mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-head text-base font-semibold">Campaign Leads ({c.leads.length})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button data-testid="add-lead-campaign" className="flex items-center gap-1.5 rounded-md hairline hover:bg-white/5 px-3 h-9 text-sm transition-colors"><Plus className="h-4 w-4" /> Add Leads</button>
          </DialogTrigger>
          <DialogContent className="surface-2 border-white/10 max-h-[70vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-head">Add leads to campaign</DialogTitle></DialogHeader>
            <div className="space-y-1">
              {available.slice(0, 40).map((l) => (
                <button key={l.id} onClick={() => addLead(l.id)} className="flex w-full items-center justify-between rounded-md px-3 py-2 hover:bg-white/5 text-left">
                  <span className="text-sm text-zinc-200">{l.business_name}</span>
                  <Plus className="h-4 w-4 text-[#3b82f6]" />
                </button>
              ))}
              {available.length === 0 && <p className="text-sm text-zinc-600 p-3">All leads already in campaigns.</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-zinc-500 font-mono border-b border-white/8">
            <th className="px-4 py-3">Business</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Conversion</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {c.leads.map((l) => (
              <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 cursor-pointer" onClick={() => nav(`/leads/${l.id}`)}><span className="text-zinc-100">{l.business_name}</span></td>
                <td className="px-4 py-3 font-mono text-zinc-300">{l.lead_score}</td>
                <td className="px-4 py-3"><ConvBadge level={l.conversion_score} /></td>
                <td className="px-4 py-3"><StageBadge stage={l.pipeline_status} /></td>
                <td className="px-4 py-3 text-right"><button onClick={() => removeLead(l.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500"><X className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {c.leads.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-600">No leads in this campaign yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
