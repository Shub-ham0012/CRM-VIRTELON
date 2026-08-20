import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye, Microscope, BadgeCheck, Upload, Download, Loader2, Filter, X, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import api, { API } from "@/lib/api";
import { PageHeader, StageBadge, ConvBadge, DemoBadge, ScoreRing, PIPELINE_STAGES, EmptyState } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Restaurant", "Cafe", "Clinic", "Salon", "Manufacturer", "Logistics", "Construction", "Healthcare", "Education"];

export default function AllLeads() {
  const nav = useNavigate();
  const [leads, setLeads] = useState(null);
  const [filters, setFilters] = useState({ q: "", category: "", pipeline_status: "", research_status: "", conversion_score: "" });
  const [uploading, setUploading] = useState(false);
  const [researching, setResearching] = useState(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    const { data } = await api.get(`/leads?${params.toString()}`);
    setLeads(data);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v === "__all" ? "" : v }));
  const clearFilters = () => setFilters({ q: "", category: "", pipeline_status: "", research_status: "", conversion_score: "" });
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const research = async (id, e) => {
    e.stopPropagation();
    setResearching(id);
    try { await api.post(`/leads/${id}/research`); toast.success("Research complete"); nav(`/leads/${id}`); }
    catch { toast.error("Research failed"); }
    finally { setResearching(null); }
  };

  const qualify = async (id, e) => {
    e.stopPropagation();
    await api.patch(`/leads/${id}/stage`, { pipeline_status: "QUALIFIED" });
    toast.success("Marked qualified"); load();
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/leads/${id}`); toast.success("Lead deleted"); load();
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/leads/import-csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.inserted} lead(s)`); load();
    } catch { toast.error("Import failed"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const exportCsv = async () => {
    const token = localStorage.getItem("vc_token");
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.pipeline_status) params.append("pipeline_status", filters.pipeline_status);
    const res = await fetch(`${API}/export/leads-csv?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "virtelon_leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const FSelect = ({ v, on, ph, opts, testid }) => (
    <Select value={v || "__all"} onValueChange={on}>
      <SelectTrigger data-testid={testid} className="h-9 w-auto min-w-[130px] rounded-md bg-black/30 hairline text-sm px-3"><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent className="surface-2 border-white/10">
        <SelectItem value="__all">{ph}</SelectItem>
        {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="fade-up">
      <PageHeader title="All Leads" subtitle={leads ? `${leads.length} leads in your database` : ""}>
        <label className="flex items-center gap-1.5 rounded-md hairline hover:bg-white/5 px-3 h-9 text-sm cursor-pointer transition-colors" data-testid="import-csv-btn">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
          <input type="file" accept=".csv" className="hidden" onChange={onUpload} />
        </label>
        <button data-testid="export-csv-btn" onClick={exportCsv} className="flex items-center gap-1.5 rounded-md hairline hover:bg-white/5 px-3 h-9 text-sm transition-colors">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={() => nav("/finder")} className="flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-3 h-9 text-sm font-medium transition-colors">Find Leads</button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <input data-testid="leads-search" value={filters.q} onChange={(e) => setF("q", e.target.value)} placeholder="Search by name…"
            className="h-9 w-56 rounded-md bg-black/30 hairline px-3 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50" />
        </div>
        <FSelect v={filters.category} on={(v) => setF("category", v)} ph="Category" opts={CATEGORIES} testid="filter-category" />
        <FSelect v={filters.pipeline_status} on={(v) => setF("pipeline_status", v)} ph="Stage" opts={PIPELINE_STAGES} testid="filter-stage" />
        <FSelect v={filters.research_status} on={(v) => setF("research_status", v)} ph="Research" opts={["Researched", "Not Researched"]} />
        <FSelect v={filters.conversion_score} on={(v) => setF("conversion_score", v)} ph="Conversion" opts={["HIGH", "MEDIUM", "LOW"]} />
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 px-2 h-9"><X className="h-3.5 w-3.5" /> Clear</button>
        )}
      </div>

      {/* Table */}
      {!leads ? <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>
        : leads.length === 0 ? <EmptyState icon={Filter} title="No leads match" subtitle="Adjust filters or find new leads." action={<button onClick={() => nav("/finder")} className="rounded-md bg-[#2563eb] px-4 h-9 text-sm">Find Leads</button>} />
        : (
        <div className="surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 font-mono border-b border-white/8">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Conversion</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Research</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} data-testid="lead-row" onClick={() => nav(`/leads/${l.id}`)}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-100 font-medium">{l.business_name}</span>
                        {l.is_demo && <DemoBadge />}
                      </div>
                      <div className="text-[11px] text-zinc-500">{l.category}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{l.location}</td>
                    <td className="px-4 py-3"><span className="font-mono text-zinc-200">{l.lead_score}</span><span className="text-zinc-600 text-xs">/100</span></td>
                    <td className="px-4 py-3"><ConvBadge level={l.conversion_score} /></td>
                    <td className="px-4 py-3"><StageBadge stage={l.pipeline_status} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${l.research_status === "Researched" ? "text-emerald-400" : "text-zinc-600"}`}>{l.research_status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button title="View" onClick={(e) => { e.stopPropagation(); nav(`/leads/${l.id}`); }} className="p-1.5 rounded hover:bg-white/10 text-zinc-400"><Eye className="h-4 w-4" /></button>
                        <button title="Research" data-testid="lead-research-btn" onClick={(e) => research(l.id, e)} className="p-1.5 rounded hover:bg-white/10 text-violet-400">
                          {researching === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Microscope className="h-4 w-4" />}
                        </button>
                        <button title="Mark qualified" onClick={(e) => qualify(l.id, e)} className="p-1.5 rounded hover:bg-white/10 text-emerald-400"><BadgeCheck className="h-4 w-4" /></button>
                        <button title="Delete" onClick={(e) => remove(l.id, e)} className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
