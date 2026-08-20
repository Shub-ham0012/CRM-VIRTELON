import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Circle, Calendar, CreditCard } from "lucide-react";
import { toast } from "sonner";
import api, { inr } from "@/lib/api";
import { DemoBadge } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["Planning", "Design", "Development", "Testing", "Deployment", "Completed", "On Hold"];

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);

  const load = useCallback(async () => { const { data } = await api.get(`/projects/${id}`); setP(data); }, [id]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (status) => { await api.patch(`/projects/${id}`, { status }); toast.success("Status updated"); load(); };
  const toggleMilestone = async (mid) => {
    const milestones = p.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m));
    setP({ ...p, milestones });
    await api.patch(`/projects/${id}`, { milestones });
  };
  const setPayment = async (payment_status) => { await api.patch(`/projects/${id}`, { payment_status }); toast.success("Payment updated"); load(); };

  if (!p) return <div className="grid place-items-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;
  const done = (p.milestones || []).filter((m) => m.done).length;

  return (
    <div className="fade-up">
      <button onClick={() => nav("/projects")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-4"><ArrowLeft className="h-4 w-4" /> Projects</button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2"><h1 className="font-head text-2xl font-semibold">{p.name}</h1>{p.is_demo && <DemoBadge />}</div>
          <p className="mt-1 text-sm text-zinc-500">{p.client_name} · {inr(p.value)}</p>
        </div>
        <Select value={p.status} onValueChange={setStatus}><SelectTrigger className="h-9 w-40 bg-black/30 hairline text-sm"><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 surface rounded-lg p-5">
          <h2 className="font-head text-base font-semibold mb-4">Milestones ({done}/{(p.milestones || []).length})</h2>
          <div className="space-y-2">
            {(p.milestones || []).map((m) => (
              <button key={m.id} onClick={() => toggleMilestone(m.id)} className="flex w-full items-center gap-3 rounded-md p-3 hairline hover:bg-white/5 text-left transition-colors">
                {m.done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-zinc-600" />}
                <span className={m.done ? "text-zinc-500 line-through" : "text-zinc-200"}>{m.title}</span>
              </button>
            ))}
            {(p.milestones || []).length === 0 && <p className="text-sm text-zinc-600">No milestones defined.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface rounded-lg p-5">
            <h2 className="font-head text-sm font-semibold mb-3">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-zinc-500">Value</span><span className="font-mono text-white">{inr(p.value)}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start</span><span className="text-zinc-300">{p.start_date?.slice(0, 10) || "—"}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Deadline</span><span className="text-zinc-300">{p.deadline?.slice(0, 10) || "—"}</span></div>
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-mono uppercase text-zinc-600 mb-1.5">Technology</div>
              <div className="flex flex-wrap gap-1.5">{(p.technology || []).map((t) => <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-xs font-mono text-zinc-300">{t}</span>)}</div>
            </div>
          </div>
          <div className="surface rounded-lg p-5">
            <h2 className="font-head text-sm font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-[#3b82f6]" /> Payment</h2>
            <Select value={p.payment_status} onValueChange={setPayment}><SelectTrigger className="h-9 bg-black/30 hairline text-sm"><SelectValue /></SelectTrigger><SelectContent className="surface-2 border-white/10">{["Pending", "Partial", "Paid"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
      </div>
    </div>
  );
}
