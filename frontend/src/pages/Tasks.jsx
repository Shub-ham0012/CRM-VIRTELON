import { useEffect, useState } from "react";
import { Plus, Loader2, CheckSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader, DemoBadge, EmptyState } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";
const PRIORITY = { Low: "#71717a", Medium: "#3b82f6", High: "#f59e0b", Critical: "#ef4444" };
const STATUSES = ["Todo", "In Progress", "Done"];

export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", assigned_to: "", priority: "Medium", due_date: "", status: "Todo" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const load = () => api.get("/tasks").then((r) => setTasks(r.data));
  useEffect(() => { load(); api.get("/users").then((r) => setUsers(r.data)); }, []);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const submit = async () => {
    if (!f.title) return toast.error("Title required");
    setSaving(true);
    try { await api.post("/tasks", f); toast.success("Task created"); setOpen(false); setF({ title: "", assigned_to: "", priority: "Medium", due_date: "", status: "Todo" }); load(); }
    catch { toast.error("Failed"); } finally { setSaving(false); }
  };
  const move = async (id, status) => { await api.patch(`/tasks/${id}`, { status }); load(); };
  const remove = async (id) => { await api.delete(`/tasks/${id}`); load(); };

  if (!tasks) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up">
      <PageHeader title="Tasks" subtitle={`${tasks.filter((t) => t.status !== "Done").length} open tasks`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="new-task-btn" className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> New Task</button></DialogTrigger>
          <DialogContent className="surface-2 border-white/10">
            <DialogHeader><DialogTitle className="font-head">New Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input data-testid="task-title" className={FIELD} placeholder="Task title" value={f.title} onChange={(e) => set("title", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={f.assigned_to} onValueChange={(v) => set("assigned_to", v)}><SelectTrigger className={FIELD}><SelectValue placeholder="Assign to" /></SelectTrigger><SelectContent className="surface-2 border-white/10">{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
                <Select value={f.priority} onValueChange={(v) => set("priority", v)}><SelectTrigger className={FIELD}><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{Object.keys(PRIORITY).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <input type="date" className={FIELD} value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
              <button data-testid="task-save" onClick={submit} disabled={saving} className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">{saving ? "Saving…" : "Create Task"}</button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {tasks.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks" />
        : (
        <div className="grid md:grid-cols-3 gap-3">
          {STATUSES.map((status) => (
            <div key={status}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="font-mono text-xs uppercase text-zinc-400">{status}</span>
                <span className="text-xs text-zinc-600">{tasks.filter((t) => t.status === status).length}</span>
              </div>
              <div className="space-y-2">
                {tasks.filter((t) => t.status === status).map((t) => (
                  <div key={t.id} data-testid="task-card" className="surface rounded-md p-3" style={{ borderLeft: `2px solid ${PRIORITY[t.priority]}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-zinc-100">{t.title}</span>
                      <button onClick={() => remove(t.id)} className="p-1 rounded hover:bg-white/10 text-zinc-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {t.is_demo && <DemoBadge />}
                        <span className="text-[10px] font-mono" style={{ color: PRIORITY[t.priority] }}>{t.priority}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{t.due_date?.slice(0, 10)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{userName(t.assigned_to)}</span>
                      <Select value={t.status} onValueChange={(v) => move(t.id, v)}><SelectTrigger className="h-6 w-24 bg-black/20 hairline text-[10px] px-2"><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
