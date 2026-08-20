import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("shubham@virtelon.com");
  const [password, setPassword] = useState("Virtelon@2025");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const founders = [
    { name: "Shubham Raj", email: "shubham@virtelon.com" },
    { name: "Sanskar Mishra", email: "sanskar@virtelon.com" },
    { name: "Vijayant Priyadarshi", email: "vijayant@virtelon.com" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 grain">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-white/8 bg-[#0b0b0d] relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2563eb]">
            <Zap className="h-5 w-5 text-white" fill="white" />
          </div>
          <div>
            <div className="font-head text-base font-semibold">VIRTELON</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Command Centre</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="font-head text-4xl font-semibold leading-tight">
            AI-powered Lead Intelligence & Business Operations.
          </h1>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Find leads, research prospects, understand their pain, recommend the right Virtelon
            solution, and drive them through the pipeline — all in one command centre.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 font-mono text-[11px] text-zinc-500">
            {["FIND", "QUALIFY", "RESEARCH", "PITCH", "OUTREACH", "MEETING", "CLIENT", "PROJECT"].map((s, i) => (
              <span key={s} className="rounded bg-white/5 px-2 py-1 border border-white/8">{i + 1}. {s}</span>
            ))}
          </div>
        </div>
        <div className="text-xs text-zinc-600">Virtelon Pvt. Ltd. · Internal use only</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2563eb]"><Zap className="h-5 w-5 text-white" fill="white" /></div>
            <div className="font-head font-semibold">VIRTELON</div>
          </div>
          <h2 className="font-head text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-zinc-500">Access the Virtelon Command Centre.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs text-zinc-500 font-medium">Email</label>
              <input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Password</label>
              <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-black/30 hairline px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/50" />
            </div>
            {error && <div data-testid="login-error" className="text-sm text-red-400 bg-red-400/10 rounded-md px-3 py-2 border border-red-400/20">{error}</div>}
            <button data-testid="login-submit" disabled={loading} type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] h-10 text-sm font-medium transition-colors disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-2">Founder accounts</div>
            <div className="space-y-1">
              {founders.map((f) => (
                <button key={f.email} onClick={() => { setEmail(f.email); setPassword("Virtelon@2025"); }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-white/5 hairline">
                  <span className="text-zinc-300">{f.name}</span>
                  <span className="text-xs text-zinc-600 font-mono">{f.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
