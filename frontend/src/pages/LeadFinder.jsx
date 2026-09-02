import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Sparkles, MapPin, Globe, Instagram, CheckCircle2, Plus, Info, Database, Bookmark, X } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { PageHeader, ScoreRing, ConvBadge, DemoBadge } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "mt-1.5 w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";
const CATEGORIES = ["Restaurant", "Cafe", "Clinic", "Salon", "Manufacturer", "Logistics", "Construction", "Healthcare", "Education"];
const PROJECT_TYPES = ["Website", "Website + WhatsApp Automation", "Booking System", "CRM", "ERP", "Mobile App", "AI Chatbot", "Dashboard"];

function Labeled({ label, children }) {
  return <div><label className="text-xs text-zinc-500 font-medium">{label}</label>{children}</div>;
}

export default function LeadFinder() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    category: "Restaurant", location: "Gurugram", count: 20,
    target_market: "Small Business", min_score: 60, website_status: "Any",
    business_size: "Any", project_type: "Website + WhatsApp Automation",
  });
  const [results, setResults] = useState(null);
  const [provider, setProvider] = useState(null);
  const [sources, setSources] = useState([]);
  const [noResults, setNoResults] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saved, setSaved] = useState([]);

  useEffect(() => { api.get("/saved-searches").then((r) => setSaved(r.data)).catch(() => {}); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const find = async (override) => {
    const f = { ...form, ...(override || {}) };
    setLoading(true); setNoResults(false);
    try {
      const { data } = await api.post("/leads/find", { ...f, count: Number(f.count), min_score: Number(f.min_score) });
      setResults(data.results); setProvider(data.provider);
      setSources(data.sources_used || []); setNoResults(data.no_results); setIsDemo(false);
    } catch (e) {
      const msg = e.response?.data?.detail
        ? formatApiError(e.response.data.detail)
        : "Couldn't reach the server. It may be waking up from idle (free tier) or the free lead sources are temporarily rate-limited — wait a bit and try again.";
      toast.error(msg);
    }
    finally { setLoading(false); }
  };

  const loadDemo = async () => {
    setDemoLoading(true); setNoResults(false);
    try {
      const { data } = await api.post("/leads/find-demo", { ...form, count: Number(form.count), min_score: Number(form.min_score) });
      setResults(data.results); setProvider(data.provider); setSources([]); setIsDemo(true);
    } catch (e) { toast.error("Failed to load demo data"); }
    finally { setDemoLoading(false); }
  };

  const saveSearch = async () => {
    const name = window.prompt("Name this search:", `${form.category} in ${form.location}`);
    if (!name) return;
    try {
      const { data } = await api.post("/saved-searches", { name, params: form });
      setSaved((s) => [data, ...s]); toast.success("Search saved");
    } catch { toast.error("Failed to save search"); }
  };
  const runSaved = (s) => {
    setForm((f) => ({ ...f, ...s.params }));
    find(s.params);
  };
  const delSaved = async (e, id) => {
    e.stopPropagation();
    await api.delete(`/saved-searches/${id}`);
    setSaved((s) => s.filter((x) => x.id !== id));
  };

  const importAll = async () => {
    setImporting(true);
    try {
      const { data } = await api.post("/leads/import", { leads: results });
      toast.success(`${data.inserted} lead(s) saved${data.skipped ? `, ${data.skipped} duplicate(s) skipped` : ""}`);
      nav("/leads");
    } catch (e) { toast.error("Import failed"); }
    finally { setImporting(false); }
  };

  return (
    <div className="fade-up">
      <PageHeader title="Lead Finder" subtitle="Discover high-potential prospects, then research and qualify them." />

      {/* Search panel */}
      <div className="surface rounded-lg p-5">
        <div className="grid md:grid-cols-4 gap-4">
          <Labeled label="Business Category">
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger data-testid="finder-category" className={FIELD + " justify-between"}><SelectValue /></SelectTrigger>
              <SelectContent className="surface-2 border-white/10">{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Location">
            <input data-testid="finder-location" className={FIELD} value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Labeled>
          <Labeled label="Number of Leads">
            <input data-testid="finder-count" type="number" min={1} max={50} className={FIELD} value={form.count} onChange={(e) => set("count", e.target.value)} />
          </Labeled>
          <Labeled label="Target Market">
            <Select value={form.target_market} onValueChange={(v) => set("target_market", v)}>
              <SelectTrigger className={FIELD + " justify-between"}><SelectValue /></SelectTrigger>
              <SelectContent className="surface-2 border-white/10">
                {["Small Business", "Mid Market", "Enterprise B2B"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Minimum Lead Score">
            <input data-testid="finder-minscore" type="number" min={0} max={100} className={FIELD} value={form.min_score} onChange={(e) => set("min_score", e.target.value)} />
          </Labeled>
          <Labeled label="Website Status">
            <Select value={form.website_status} onValueChange={(v) => set("website_status", v)}>
              <SelectTrigger className={FIELD + " justify-between"}><SelectValue /></SelectTrigger>
              <SelectContent className="surface-2 border-white/10">{["Any", "Missing", "Weak"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Business Size">
            <Select value={form.business_size} onValueChange={(v) => set("business_size", v)}>
              <SelectTrigger className={FIELD + " justify-between"}><SelectValue /></SelectTrigger>
              <SelectContent className="surface-2 border-white/10">{["Any", "Small", "Mid", "Large"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Project Type">
            <Select value={form.project_type} onValueChange={(v) => set("project_type", v)}>
              <SelectTrigger className={FIELD + " justify-between"}><SelectValue /></SelectTrigger>
              <SelectContent className="surface-2 border-white/10">{PROJECT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button data-testid="finder-search-btn" onClick={find} disabled={loading || demoLoading}
            className="flex items-center gap-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-5 h-10 text-sm font-medium transition-colors disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} FIND LEADS
          </button>
          <button data-testid="finder-demo-btn" onClick={loadDemo} disabled={loading || demoLoading}
            className="flex items-center gap-2 rounded-md hairline hover:bg-white/5 px-4 h-10 text-sm transition-colors disabled:opacity-60">
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Load Demo Data
          </button>
          <button data-testid="finder-save-search" onClick={saveSearch} disabled={loading || demoLoading}
            className="flex items-center gap-2 rounded-md hairline hover:bg-white/5 px-4 h-10 text-sm transition-colors disabled:opacity-60">
            <Bookmark className="h-4 w-4" /> Save Search
          </button>
          <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[#3b82f6]" /> Zero-cost multi-source discovery: OpenStreetMap + open-web search</span>
        </div>
        {saved.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-zinc-600">Saved:</span>
            {saved.map((s) => (
              <span key={s.id} data-testid="saved-search-chip" onClick={() => runSaved(s)}
                className="group flex items-center gap-1.5 rounded-full hairline hover:bg-white/5 pl-3 pr-2 h-7 text-xs cursor-pointer transition-colors">
                {s.name}
                <button onClick={(e) => delSaved(e, s.id)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {results && !isDemo && results.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-400/8 border border-emerald-400/20 px-4 py-3 text-sm text-emerald-300/90">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Live results</strong> from {sources.map((s) => (s === "openstreetmap" ? "OpenStreetMap" : "open-web search")).join(" + ") || "the open web"} (free, no API key). Every result shows its source URL. Missing fields show <strong>“Not found”</strong> — nothing is fabricated. Verify manually before outreach.</span>
        </div>
      )}
      {isDemo && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-400/8 border border-amber-400/20 px-4 py-3 text-sm text-amber-300/90">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{provider?.note} These are <strong>DEMO</strong> samples, not live data.</span>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head text-base font-semibold">{results.length} {isDemo ? "demo records" : "verified prospects"}</h2>
            <button data-testid="finder-import-all" onClick={importAll} disabled={importing}
              className="flex items-center gap-1.5 rounded-md hairline hover:bg-white/5 px-3 h-9 text-sm transition-colors disabled:opacity-60">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save all to database
            </button>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {results.map((l) => (
              <div key={l.id} data-testid="finder-result-card" className="surface rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ScoreRing score={l.lead_score} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-head font-semibold text-white truncate">{l.business_name}</h3>
                      {l.is_demo && <DemoBadge />}
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{l.location} · {l.category}</div>
                    <div className="mt-1.5"><ConvBadge level={l.conversion_score} /></div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span className={`rounded px-2 py-0.5 border ${!l.website ? "text-red-400 border-red-400/20 bg-red-400/10" : "text-zinc-400 border-white/10 bg-white/5"}`}>
                    <Globe className="h-3 w-3 inline mr-1" />{l.website ? "Website" : "No website"}
                  </span>
                  {l.instagram_url && <span className="rounded px-2 py-0.5 border border-pink-400/20 bg-pink-400/10 text-pink-400"><Instagram className="h-3 w-3 inline mr-1" />Insta</span>}
                  <span className={`rounded px-2 py-0.5 border ${l.phone ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" : "text-zinc-600 border-white/10 bg-white/5"}`}>{l.phone ? "Phone ✓" : "Phone: Not found"}</span>
                </div>
                <p className="mt-3 text-xs text-zinc-500 leading-relaxed line-clamp-2">{l.reason}</p>
                {l.source_url && (
                  <a href={l.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#3b82f6] hover:underline">
                    Source: {l.source === "duckduckgo" ? "Open-web" : l.source === "openstreetmap" ? "OpenStreetMap" : "Web"} <Globe className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results && results.length === 0 && noResults && (
        <div className="mt-16 text-center fade-up">
          <Search className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
          <h3 className="font-head text-lg text-zinc-300">No verified live results found</h3>
          <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">{provider?.note}</p>
          <button data-testid="finder-demo-empty-btn" onClick={loadDemo} disabled={demoLoading}
            className="mt-5 inline-flex items-center gap-2 rounded-md hairline hover:bg-white/5 px-4 h-9 text-sm transition-colors">
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Load Demo Data instead
          </button>
        </div>
      )}

      {!results && (
        <div className="mt-16 text-center text-zinc-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Set your criteria and run a search to discover real prospects from the open web.</p>
        </div>
      )}
    </div>
  );
}
