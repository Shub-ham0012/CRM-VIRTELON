import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, Plug, KeyRound } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/shared";
import { useAuth } from "@/context/AuthContext";

const FIELD = "mt-1.5 w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50";

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      toast.success("Password updated");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4 max-w-2xl">
      <div>
        <label className="text-xs text-zinc-500 font-medium">Current password</label>
        <input data-testid="change-pw-current" type="password" required className={FIELD}
          value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-zinc-500 font-medium">New password</label>
        <input data-testid="change-pw-new" type="password" required minLength={8} className={FIELD}
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-zinc-500 font-medium">Confirm new password</label>
        <input data-testid="change-pw-confirm" type="password" required minLength={8} className={FIELD}
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      <div className="sm:col-span-3">
        <button data-testid="change-pw-submit" type="submit" disabled={saving}
          className="flex items-center gap-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] px-4 h-9 text-sm font-medium transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update password
        </button>
      </div>
    </form>
  );
}

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
        <h2 className="font-head text-base font-semibold mb-4">Change Password</h2>
        <ChangePasswordForm />
      </div>

      <div className="surface rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-4 w-4 text-[#3b82f6]" />
          <h2 className="font-head text-base font-semibold">Integrations</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          The AI engine and all research/discovery run <strong className="text-emerald-400">live at zero cost</strong>.
          Lead Finder uses <strong className="text-emerald-400">live OpenStreetMap</strong> public data (no API key) and
          falls back to clearly-labeled DEMO data only if the open web is unavailable. {d.lead_provider.note}
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
