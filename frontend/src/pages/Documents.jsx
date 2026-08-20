import { useEffect, useState } from "react";
import { Plus, Loader2, FileText, Trash2, FileArchive, FileSpreadsheet, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader, DemoBadge, EmptyState } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";
const CATEGORIES = ["Proposals", "Contracts", "Client documents", "Project documents", "Lead research", "Excel/CSV imports", "Other"];
const ICONS = { Proposals: FileText, Contracts: FileCheck2, "Excel/CSV imports": FileSpreadsheet };

export default function Documents() {
  const [docs, setDocs] = useState(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "Proposals", note: "", url: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const load = () => api.get("/documents").then((r) => setDocs(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    try { await api.post("/documents", f); toast.success("Document added"); setOpen(false); setF({ name: "", category: "Proposals", note: "", url: "" }); load(); }
    catch { toast.error("Failed"); } finally { setSaving(false); }
  };
  const remove = async (id) => { await api.delete(`/documents/${id}`); load(); };

  if (!docs) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;
  const grouped = CATEGORIES.map((cat) => [cat, docs.filter((d) => d.category === cat)]).filter(([, arr]) => arr.length);

  return (
    <div className="fade-up">
      <PageHeader title="Documents" subtitle="Reference store for proposals, contracts and project files.">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="new-doc-btn" className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> Add Document</button></DialogTrigger>
          <DialogContent className="surface-2 border-white/10">
            <DialogHeader><DialogTitle className="font-head">Add Document Reference</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input data-testid="doc-name" className={FIELD} placeholder="Document name" value={f.name} onChange={(e) => set("name", e.target.value)} />
              <Select value={f.category} onValueChange={(v) => set("category", v)}><SelectTrigger className={FIELD}><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              <input className={FIELD} placeholder="Link / URL (optional)" value={f.url} onChange={(e) => set("url", e.target.value)} />
              <input className={FIELD} placeholder="Note" value={f.note} onChange={(e) => set("note", e.target.value)} />
              <p className="text-[11px] text-zinc-600">Cloud storage upload (S3/GCS) can be connected later in Settings.</p>
              <button data-testid="doc-save" onClick={submit} disabled={saving} className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">{saving ? "Saving…" : "Add Document"}</button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {docs.length === 0 ? <EmptyState icon={FileText} title="No documents" />
        : (
        <div className="space-y-6">
          {grouped.map(([cat, arr]) => {
            const Icon = ICONS[cat] || FileArchive;
            return (
              <div key={cat}>
                <h2 className="font-head text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2"><Icon className="h-4 w-4" /> {cat} <span className="text-zinc-600 font-mono text-xs">({arr.length})</span></h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {arr.map((d) => (
                    <div key={d.id} className="surface rounded-md p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-200 truncate">{d.name}{d.is_demo && <DemoBadge />}</div>
                        {d.note && <div className="text-[11px] text-zinc-600 truncate">{d.note}</div>}
                      </div>
                      <button onClick={() => remove(d.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
