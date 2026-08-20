import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Sparkles, MapPin, Globe, Instagram, CheckCircle2, Plus, Info } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
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
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const find = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/leads/find", { ...form, count: Number(form.count), min_score: Number(form.min_score) });
      setResults(data.results); setProvider(data.provider); setFallback(data.fallback);
    } catch (e) { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  const importAll = async () => {
    setImporting(true);
    try {
      const { data } = await api.post("/leads/import", { leads: results });
      toast.success(`${data.inserted} lead(s) saved to your database`);
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
        <div className="mt-5 flex items-center gap-3">
          <button data-testid="finder-search-btn" onClick={find} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-5 h-10 text-sm font-medium transition-colors disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} FIND LEADS
          </button>
          <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[#3b82f6]" /> Zero-cost open-web discovery via OpenStreetMap · provider abstraction ready for future upgrades</span>
        </div>
      </div>

      {provider && !fallback && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-400/8 border border-emerald-400/20 px-4 py-3 text-sm text-emerald-300/90">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Live results</strong> from OpenStreetMap public data (free, no API key). All fields are real; anything not published shows <strong>“Not found”</strong>. Verify manually before outreach.</span>
        </div>
      )}
      {provider && fallback && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-400/8 border border-amber-400/20 px-4 py-3 text-sm text-amber-300/90">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{provider.note} These are <strong>DEMO</strong> samples, not live data.</span>
        </div>
      )}

      {results && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head text-base font-semibold">{results.length} prospects found</h2>
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
                  <span className={`rounded px-2 py-0.5 border ${l.website_status === "Missing" ? "text-red-400 border-red-400/20 bg-red-400/10" : "text-zinc-400 border-white/10 bg-white/5"}`}>
                    <Globe className="h-3 w-3 inline mr-1" />{l.website ? "Website" : "No website"}
                  </span>
                  {l.instagram_url && <span className="rounded px-2 py-0.5 border border-pink-400/20 bg-pink-400/10 text-pink-400"><Instagram className="h-3 w-3 inline mr-1" />Insta</span>}
                  <span className={`rounded px-2 py-0.5 border ${l.phone ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" : "text-zinc-600 border-white/10 bg-white/5"}`}>{l.phone ? "Phone ✓" : "Phone: Not found"}</span>
                </div>
                <p className="mt-3 text-xs text-zinc-500 leading-relaxed line-clamp-2">{l.reason}</p>
                {l.source_url && (
                  <a href={l.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#3b82f6] hover:underline">
                    Source: OpenStreetMap <Globe className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!results && (
        <div className="mt-16 text-center text-zinc-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Set your criteria and run a search to discover prospects.</p>
        </div>
      )}
    </div>
  );
}
