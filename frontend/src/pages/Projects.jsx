import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, FolderKanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { inr } from "@/lib/api";
import { PageHeader, DemoBadge, EmptyState } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";
const STATUSES = ["Planning", "Design", "Development", "Testing", "Deployment", "Completed", "On Hold"];
const STATUS_COLOR = { Planning: "#3b82f6", Design: "#8b5cf6", Development: "#f59e0b", Testing: "#06b6d4", Deployment: "#6366f1", Completed: "#22c55e", "On Hold": "#71717a" };

function progress(p) {
  const done = (p.milestones || []).filter((m) => m.done).length;
  const total = (p.milestones || []).length || 1;
  return Math.round((done / total) * 100);
}

export default function Projects() {
  const [projects, setProjects] = useState(null);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", client_id: "", value: 0, status: "Planning", deadline: "", technology: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api.get("/projects").then((r) => setProjects(r.data)); api.get("/clients").then((r) => setClients(r.data)); if (sp.get("new")) setOpen(true); }, [sp]);

  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    setSaving(true);
    const client = clients.find((c) => c.id === f.client_id);
    try {
      const { data } = await api.post("/projects", { ...f, value: Number(f.value), client_name: client?.company, technology: f.technology ? f.technology.split(",").map((t) => t.trim()) : [] });
      setProjects((p) => [data, ...p]); toast.success("Project created"); setOpen(false);
      setF({ name: "", client_id: "", value: 0, status: "Planning", deadline: "", technology: "" });
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  };

  if (!projects) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Projects" subtitle={`${projects.length} projects`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="new-project-btn" className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> Add Project</button></DialogTrigger>
          <DialogContent className="surface-2 border-white/10">
            <DialogHeader><DialogTitle className="font-head">Add Project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input data-testid="project-name" className={FIELD} placeholder="Project name" value={f.name} onChange={(e) => set("name", e.target.value)} />
              <Select value={f.client_id} onValueChange={(v) => set("client_id", v)}><SelectTrigger className={FIELD}><SelectValue placeholder="Client" /></SelectTrigger><SelectContent className="surface-2 border-white/10">{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>)}</SelectContent></Select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className={FIELD} placeholder="Value ₹" value={f.value} onChange={(e) => set("value", e.target.value)} />
                <Select value={f.status} onValueChange={(v) => set("status", v)}><SelectTrigger className={FIELD}><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <input type="date" className={FIELD} value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
              <input className={FIELD} placeholder="Technology (comma separated)" value={f.technology} onChange={(e) => set("technology", e.target.value)} />
              <button data-testid="project-save" onClick={submit} disabled={saving} className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">{saving ? "Saving…" : "Create Project"}</button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {projects.length === 0 ? <EmptyState icon={FolderKanban} title="No projects yet" />
        : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map((p) => (
            <button key={p.id} data-testid="project-card" onClick={() => nav(`/projects/${p.id}`)} className="surface rounded-lg p-5 text-left hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase" style={{ color: STATUS_COLOR[p.status] }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[p.status] }} />{p.status}</span>
                {p.is_demo && <DemoBadge />}
              </div>
              <h3 className="mt-3 font-head font-semibold text-white">{p.name}</h3>
              <p className="text-xs text-zinc-500 mt-1">{p.client_name || "—"} · {inr(p.value)}</p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1"><span>Progress</span><span className="font-mono">{progress(p)}%</span></div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${progress(p)}%` }} /></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(p.technology || []).slice(0, 3).map((t) => <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">{t}</span>)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
