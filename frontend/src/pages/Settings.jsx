import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, Plug, KeyRound } from "lucide-react";
import api from "@/lib/api";
import { PageHeader } from "@/components/shared";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/settings/integrations").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="grid place-items-center h-60"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  return (
    <div className="fade-up space-y-6">
      <PageHeader title="Settings" subtitle="Profile and integration configuration." />

      <div className="surface rounded-lg p-5">
        <h2 className="font-head text-base font-semibold mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          {user?.avatar && <img src={user.avatar} className="h-14 w-14 rounded-full object-cover ring-1 ring-white/10" alt="" />}
          <div>
            <div className="text-white font-medium">{user?.name}</div>
            <div className="text-sm text-zinc-500">{user?.email}</div>
            <span className="mt-1 inline-block rounded bg-[#2563eb]/15 px-1.5 py-0.5 text-[10px] font-mono uppercase text-[#3b82f6]">{user?.role}</span>
          </div>
        </div>
      </div>

      <div className="surface rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-4 w-4 text-[#3b82f6]" />
          <h2 className="font-head text-base font-semibold">Integrations</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          The AI engine is live. All other integrations are placeholders — connect API keys to enable them.
          Lead Finder currently uses a <strong className="text-amber-400">mock provider</strong> ({d.lead_provider.note}).
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {d.integrations.map((it) => (
            <div key={it.key} data-testid={`integration-${it.key}`} className="rounded-md hairline p-4 flex items-start gap-3">
              {it.connected ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" /> : <Circle className="h-5 w-5 text-zinc-700 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-100 font-medium">{it.name}</span>
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${it.connected ? "text-emerald-400 bg-emerald-400/10" : "text-zinc-500 bg-white/5"}`}>{it.connected ? "Live" : "Not connected"}</span>
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5">{it.category}</div>
                <p className="text-xs text-zinc-500 mt-1.5">{it.note}</p>
                {!it.connected && (
                  <button className="mt-2 flex items-center gap-1.5 text-xs text-[#3b82f6] hover:underline"><KeyRound className="h-3 w-3" /> Configure API key</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
