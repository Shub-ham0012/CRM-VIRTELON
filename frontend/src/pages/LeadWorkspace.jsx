import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Microscope, Loader2, Copy, ExternalLink, ShieldCheck, Globe,
  Phone, Mail, Instagram, Linkedin, MapPin, Sparkles, AlertTriangle, Send,
  MessageCircle, BadgeCheck, ChevronRight, Building2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { StageBadge, ConvBadge, ScoreRing, DemoBadge, PIPELINE_STAGES } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECTIONS = [
  ["business_overview", "Business Overview"],
  ["digital_presence", "Digital Presence"],
  ["website_assessment", "Website Assessment"],
  ["social_presence", "Social Presence"],
  ["business_signals", "Business Signals"],
  ["software_opportunity", "Software Opportunity"],
  ["recommended_solution", "Recommended Virtelon Solution"],
  ["project_category", "Estimated Project Category"],
  ["outreach_channel", "Recommended Outreach Channel"],
  ["follow_up", "Follow-up Recommendation"],
];

function ContactRow({ icon: Icon, label, value, href }) {
  const verified = !!value;
  const copy = () => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); };
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">{label}</div>
        {verified ? <div className="text-sm text-zinc-200 truncate">{value}</div>
          : <div className="text-sm text-zinc-600 italic">Not found</div>}
      </div>
      {verified && (
        <div className="flex items-center gap-1">
          <button onClick={copy} className="p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Copy"><Copy className="h-3.5 w-3.5" /></button>
          {href && <a href={href} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Open"><ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
      )}
    </div>
  );
}

export default function LeadWorkspace() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [researching, setResearching] = useState(false);
  const [channel, setChannel] = useState("whatsapp");
  const [message, setMessage] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/leads/${id}`);
    setData(data);
  }, [id]);

  useEffect(() => { load(); api.get("/campaigns").then((r) => setCampaigns(r.data)); }, [load]);

  const runResearch = async () => {
    setResearching(true);
    try { await api.post(`/leads/${id}/research`); toast.success("AI research complete"); await load(); }
    catch { toast.error("Research failed"); }
    finally { setResearching(false); }
  };

  const generate = async (ch) => {
    setChannel(ch); setGenLoading(true); setMessage(null);
    try {
      const { data } = await api.post(`/leads/${id}/outreach`, { channel: ch });
      setMessage(data.content);
    } catch { toast.error("Generation failed"); }
    finally { setGenLoading(false); }
  };

  const setStage = async (stage) => { await api.patch(`/leads/${id}/stage`, { pipeline_status: stage }); toast.success(`Moved to ${stage}`); load(); };
  const markPitched = async () => { await api.post(`/leads/${id}/mark-pitched`); toast.success("Marked as pitched"); load(); };
  const addToCampaign = async (cid) => { await api.patch(`/leads/${id}`, { campaign_id: cid }); toast.success("Added to campaign"); load(); };
  const setFollowUp = async (date) => { await api.patch(`/leads/${id}`, { next_follow_up: date }); toast.success("Follow-up set"); load(); };

  if (!data) return <div className="grid place-items-center h-[70vh]"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;
  const { lead, research } = data;
  const report = research?.report;
  const vf = research?.verified_facts || {};
  const ws = vf.website || {};

  return (
    <div className="fade-up">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-4"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-4">
        {/* LEFT — Profile + Contact */}
        <div className="space-y-4">
          <div className="surface rounded-lg p-5">
            <div className="flex items-center gap-3">
              <ScoreRing score={lead.lead_score} size={56} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-head text-lg font-semibold truncate">{lead.business_name}</h1>
                  {lead.is_demo && <DemoBadge />}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.location}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StageBadge stage={lead.pipeline_status} />
              <ConvBadge level={lead.conversion_score} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-zinc-600 font-mono uppercase text-[10px]">Category</div><div className="text-zinc-300">{lead.category}</div></div>
              <div><div className="text-zinc-600 font-mono uppercase text-[10px]">Size</div><div className="text-zinc-300">{lead.business_size}</div></div>
              <div><div className="text-zinc-600 font-mono uppercase text-[10px]">Digital Presence</div><div className="text-zinc-300">{lead.digital_presence_score}/100</div></div>
              <div><div className="text-zinc-600 font-mono uppercase text-[10px]">Project</div><div className="text-zinc-300 truncate">{lead.project_type || "—"}</div></div>
            </div>
          </div>

          <div className="surface rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-[#3b82f6]" />
              <h2 className="font-head text-sm font-semibold">Contact Information</h2>
            </div>
            <p className="text-[11px] text-zinc-600 mb-2">Publicly available info only.</p>
            <div className="divide-y divide-white/5">
              <ContactRow icon={Phone} label="Phone" value={lead.phone} />
              <ContactRow icon={Mail} label="Email" value={lead.email} />
              <ContactRow icon={Globe} label="Website" value={lead.website} href={lead.website} />
              <ContactRow icon={Linkedin} label="LinkedIn" value={lead.linkedin_url} href={lead.linkedin_url} />
              <ContactRow icon={Instagram} label="Instagram" value={lead.instagram_url} href={lead.instagram_url} />
              <ContactRow icon={MapPin} label="Google Profile" value={lead.google_url} href={lead.google_url} />
            </div>
          </div>
        </div>

        {/* CENTER — AI Research Report */}
        <div className="space-y-4 min-w-0">
          <div className="surface rounded-lg p-5 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Microscope className="h-4 w-4 text-violet-400" />
                <h2 className="font-head text-base font-semibold">AI Research Report</h2>
              </div>
              <button data-testid="run-research-btn" onClick={runResearch} disabled={researching}
                className="flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-700 px-3 h-9 text-sm font-medium transition-colors disabled:opacity-60">
                {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {report ? "Regenerate" : "Run Research"}
              </button>
            </div>

            {!report ? (
              <div className="text-center py-16">
                <Microscope className="h-10 w-10 mx-auto text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">Generate an AI-powered research report analysing this prospect's digital presence, pain points and the right Virtelon solution.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md bg-amber-400/8 border border-amber-400/20 px-3 py-2 text-xs text-amber-300/90">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  The blue panel below is <strong>verified public-web evidence</strong>. Everything else is an <strong>AI-generated assessment</strong> — verify manually before outreach. Engine: {research.generated_by}.
                </div>

                {/* Verified public-web facts */}
                <div className="rounded-lg bg-[#2563eb]/8 border border-[#2563eb]/25 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-[#3b82f6]" />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#3b82f6]">Verified Facts (fetched from public web)</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Website reachable</span><span className={ws.provided ? (ws.site_loaded ? "text-emerald-400" : "text-red-400") : "text-zinc-600"}>{ws.provided ? (ws.site_loaded ? "Yes" : "No / unreachable") : "Not found"}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Booking form</span><span className="text-zinc-300">{ws.site_loaded ? (ws.has_booking_form ? "Detected" : "Not detected") : "—"}</span></div>
                    <div className="flex justify-between gap-2 min-w-0"><span className="text-zinc-500 shrink-0">Page title</span><span className="text-zinc-300 truncate">{ws.title || "Not found"}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Contact form</span><span className="text-zinc-300">{ws.site_loaded ? (ws.has_contact_form ? "Detected" : "Not detected") : "—"}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Phone on site</span><span className="text-zinc-300">{ws.public_phone_on_site || "Not found"}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Email on site</span><span className="text-zinc-300">{ws.public_email_on_site || "Not found"}</span></div>
                  </div>
                  {ws.site_loaded && ws.social_links_on_site && Object.keys(ws.social_links_on_site).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(ws.social_links_on_site).map(([net, url]) => (
                        <a key={net} href={url} target="_blank" rel="noreferrer" className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-[#3b82f6] hover:underline">{net.replace(".com", "")}</a>
                      ))}
                    </div>
                  )}
                  {Array.isArray(vf.search_results) && vf.search_results.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-mono uppercase text-zinc-600 mb-1">Public web mentions</div>
                      <div className="space-y-1">
                        {vf.search_results.slice(0, 4).map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-xs text-zinc-400 hover:text-[#3b82f6] truncate">↳ {s.title || s.url}</a>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-zinc-600">Source: prospect's public website + open web + OpenStreetMap. Free, zero-cost.</p>
                </div>

                {/* Assessment headline */}
                <div className="rounded-lg bg-violet-500/8 border border-violet-500/20 p-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-violet-400 mb-1">AI Assessment (generated)</div>
                  <p className="text-zinc-100 leading-relaxed">"{report.personalized_pitch}"</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-zinc-400">Lead Score: <span className="font-mono text-white">{report.lead_score}/100</span></span>
                    <ConvBadge level={report.conversion_potential} />
                    <span className="text-zinc-400">Channel: <span className="text-white">{report.outreach_channel}</span></span>
                  </div>
                </div>

                {/* Pain points */}
                {Array.isArray(report.pain_points) && (
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Potential Pain Points</div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.pain_points.map((p, i) => (
                        <span key={i} className="rounded-md bg-red-400/8 border border-red-400/15 px-2.5 py-1 text-xs text-red-300/90">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sections */}
                <div className="grid sm:grid-cols-2 gap-4 pt-1">
                  {SECTIONS.map(([key, label]) => report[key] && (
                    <div key={key}>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{report[key]}</p>
                    </div>
                  ))}
                </div>

                {/* Why + evidence */}
                {report.why && (
                  <div className="rounded-md hairline p-4 mt-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#3b82f6] mb-1">Why we think this</div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{report.why}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Sources + Actions + Outreach */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="surface rounded-lg p-5">
            <h2 className="font-head text-sm font-semibold mb-3">Actions</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-[11px] text-zinc-500 font-mono uppercase">Pipeline Stage</label>
                <Select value={lead.pipeline_status} onValueChange={setStage}>
                  <SelectTrigger data-testid="stage-select" className="mt-1 h-9 bg-black/30 hairline text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="surface-2 border-white/10 max-h-72">{PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 font-mono uppercase">Add to Campaign</label>
                <Select value={lead.campaign_id || "__none"} onValueChange={(v) => addToCampaign(v === "__none" ? null : v)}>
                  <SelectTrigger className="mt-1 h-9 bg-black/30 hairline text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="surface-2 border-white/10">
                    <SelectItem value="__none">None</SelectItem>
                    {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 font-mono uppercase">Next Follow-up</label>
                <input type="date" data-testid="followup-date" onChange={(e) => setFollowUp(e.target.value)}
                  defaultValue={lead.next_follow_up?.slice(0, 10) || ""}
                  className="mt-1 w-full h-9 rounded-md bg-black/30 hairline px-3 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50" />
              </div>
              <button onClick={() => setStage("QUALIFIED")} className="w-full flex items-center justify-center gap-1.5 rounded-md hairline hover:bg-white/5 h-9 text-sm transition-colors">
                <BadgeCheck className="h-4 w-4 text-emerald-400" /> Mark Qualified
              </button>
            </div>
          </div>

          {/* Sources */}
          <div className="surface rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-[#3b82f6]" />
              <h2 className="font-head text-sm font-semibold">Sources & Evidence</h2>
            </div>
            <div className="space-y-2">
              {(research?.sources || [
                { label: "Business Website", url: lead.website, verified: !!lead.website },
                { label: "Google Business Profile", url: lead.google_url, verified: !!lead.google_url },
                { label: "Instagram", url: lead.instagram_url, verified: !!lead.instagram_url },
                { label: "LinkedIn", url: lead.linkedin_url, verified: !!lead.linkedin_url },
              ]).map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{s.label}</span>
                  {s.verified && s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#3b82f6] hover:underline text-xs">Open <ExternalLink className="h-3 w-3" /></a>
                  ) : <span className="text-xs text-zinc-600 italic">Not verified</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Outreach */}
          <div className="surface rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Send className="h-4 w-4 text-[#3b82f6]" />
              <h2 className="font-head text-sm font-semibold">Outreach</h2>
            </div>
            {!report && <p className="text-xs text-zinc-600 mb-3">Run research first for a personalized message.</p>}
            <div className="grid grid-cols-3 gap-1.5">
              {[["whatsapp", "WhatsApp", MessageCircle], ["email", "Email", Mail], ["linkedin", "LinkedIn", Linkedin]].map(([ch, label, Icon]) => (
                <button key={ch} data-testid={`outreach-${ch}`} onClick={() => generate(ch)} disabled={genLoading}
                  className={`flex flex-col items-center gap-1 rounded-md py-2.5 text-[11px] transition-colors ${channel === ch ? "bg-[#2563eb]/15 text-[#3b82f6] border border-[#2563eb]/30" : "hairline hover:bg-white/5 text-zinc-400"}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            {genLoading && <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating personalized message…</div>}
            {message && !genLoading && (
              <div className="mt-3">
                <textarea data-testid="outreach-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={8}
                  className="w-full rounded-md bg-black/30 hairline p-3 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-[#2563eb]/50 resize-none" />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(message); toast.success("Copied"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md hairline hover:bg-white/5 h-9 text-sm transition-colors"><Copy className="h-4 w-4" /> Copy</button>
                  <button data-testid="mark-pitched-btn" onClick={markPitched}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-9 text-sm transition-colors"><Send className="h-4 w-4" /> Mark Pitched</button>
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">Review and approve before sending. Nothing is sent automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
