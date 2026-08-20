import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Building2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { inr } from "@/lib/api";
import { PageHeader, DemoBadge, EmptyState } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";
const STATUSES = ["Prospect", "Active", "Completed", "Inactive"];
const STATUS_COLOR = { Prospect: "#3b82f6", Active: "#22c55e", Completed: "#8b5cf6", Inactive: "#71717a" };

export default function Clients() {
  const [clients, setClients] = useState(null);
  const [open, setOpen] = useState(false);
  const [sp] = useSearchParams();
  const [f, setF] = useState({ name: "", company: "", industry: "", email: "", phone: "", deal_value: 0, status: "Prospect", source: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api.get("/clients").then((r) => setClients(r.data)); if (sp.get("new")) setOpen(true); }, [sp]);

  const submit = async () => {
    if (!f.company) return toast.error("Company required");
    setSaving(true);
    try { const { data } = await api.post("/clients", { ...f, deal_value: Number(f.deal_value) }); setClients((p) => [data, ...p]); toast.success("Client added"); setOpen(false); setF({ name: "", company: "", industry: "", email: "", phone: "", deal_value: 0, status: "Prospect", source: "" }); }
    catch { toast.error("Failed"); } finally { setSaving(false); }
  };
  const remove = async (id) => { await api.delete(`/clients/${id}`); setClients((p) => p.filter((c) => c.id !== id)); toast.success("Deleted"); };

  if (!clients) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Clients" subtitle={`${clients.length} clients · ${inr(clients.reduce((s, c) => s + (c.deal_value || 0), 0))} total deal value`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="new-client-btn" className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> Add Client</button></DialogTrigger>
          <DialogContent className="surface-2 border-white/10">
            <DialogHeader><DialogTitle className="font-head">Add Client</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input data-testid="client-company" className={FIELD} placeholder="Company" value={f.company} onChange={(e) => set("company", e.target.value)} />
                <input className={FIELD} placeholder="Contact name" value={f.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={FIELD} placeholder="Industry" value={f.industry} onChange={(e) => set("industry", e.target.value)} />
                <input className={FIELD} placeholder="Source" value={f.source} onChange={(e) => set("source", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={FIELD} placeholder="Email" value={f.email} onChange={(e) => set("email", e.target.value)} />
                <input className={FIELD} placeholder="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className={FIELD} placeholder="Deal value ₹" value={f.deal_value} onChange={(e) => set("deal_value", e.target.value)} />
                <Select value={f.status} onValueChange={(v) => set("status", v)}><SelectTrigger className={FIELD}><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <button data-testid="client-save" onClick={submit} disabled={saving} className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">{saving ? "Saving…" : "Add Client"}</button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {clients.length === 0 ? <EmptyState icon={Building2} title="No clients yet" />
        : (
        <div className="surface rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-zinc-500 font-mono border-b border-white/8">
              <th className="px-4 py-3">Company</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Industry</th><th className="px-4 py-3">Deal Value</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} data-testid="client-row" className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><span className="text-zinc-100 font-medium">{c.company}</span>{c.is_demo && <DemoBadge />}</div></td>
                  <td className="px-4 py-3 text-zinc-400">{c.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.industry}</td>
                  <td className="px-4 py-3 font-mono text-zinc-200">{inr(c.deal_value)}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-mono" style={{ color: STATUS_COLOR[c.status] }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[c.status] }} />{c.status}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
