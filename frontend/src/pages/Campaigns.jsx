import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Megaphone, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader, DemoBadge, EmptyState } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const FIELD = "w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";

function CreateCampaign({ onCreated, open, setOpen }) {
  const [f, setF] = useState({ name: "", industry: "Restaurant", location: "", offer: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    try { const { data } = await api.post("/campaigns", f); toast.success("Campaign created"); onCreated(data); setOpen(false); setF({ name: "", industry: "Restaurant", location: "", offer: "", start_date: "", end_date: "" }); }
    catch { toast.error("Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="new-campaign-btn" className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> New Campaign</button>
      </DialogTrigger>
      <DialogContent className="surface-2 border-white/10">
        <DialogHeader><DialogTitle className="font-head">Create Campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input data-testid="campaign-name" className={FIELD} placeholder="Campaign name" value={f.name} onChange={(e) => set("name", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className={FIELD} placeholder="Industry" value={f.industry} onChange={(e) => set("industry", e.target.value)} />
            <input className={FIELD} placeholder="Location" value={f.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <input className={FIELD} placeholder="Offer (e.g. Website + WhatsApp automation)" value={f.offer} onChange={(e) => set("offer", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={FIELD} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            <input type="date" className={FIELD} value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
          <button data-testid="campaign-save" onClick={submit} disabled={saving} className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">{saving ? "Saving…" : "Create Campaign"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Campaigns() {
  const [camps, setCamps] = useState(null);
  const [open, setOpen] = useState(false);
  const [sp] = useSearchParams();
  const nav = useNavigate();
  useEffect(() => { api.get("/campaigns").then((r) => setCamps(r.data)); if (sp.get("new")) setOpen(true); }, [sp]);
  if (!camps) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Campaigns" subtitle={`${camps.length} outreach campaigns`}>
        <CreateCampaign open={open} setOpen={setOpen} onCreated={(c) => setCamps((p) => [c, ...p])} />
      </PageHeader>
      {camps.length === 0 ? <EmptyState icon={Megaphone} title="No campaigns" subtitle="Group leads into targeted outreach campaigns." />
        : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {camps.map((c) => (
            <button key={c.id} data-testid="campaign-card" onClick={() => nav(`/campaigns/${c.id}`)} className="surface rounded-lg p-5 text-left hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between">
                <Megaphone className="h-5 w-5 text-[#3b82f6]" />
                {c.is_demo && <DemoBadge />}
              </div>
              <h3 className="mt-3 font-head font-semibold text-white">{c.name}</h3>
              <p className="text-xs text-zinc-500 mt-1">{c.industry} · {c.location}</p>
              <p className="text-xs text-zinc-400 mt-2 line-clamp-1">{c.offer}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[["Leads", c.stats.total], ["Qual.", c.stats.qualified], ["Pitched", c.stats.pitched], ["Won", c.stats.won]].map(([l, v]) => (
                  <div key={l}><div className="font-mono text-lg text-white">{v}</div><div className="text-[10px] text-zinc-600 uppercase">{l}</div></div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Conversion <span className="text-emerald-400 font-mono">{c.stats.conversion_rate}%</span></span>
                <ArrowRight className="h-4 w-4 text-zinc-600" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
