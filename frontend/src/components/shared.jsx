import { cn } from "@/lib/utils";

export const STAGE_COLORS = {
  NEW: "#3b82f6",
  RESEARCHING: "#8b5cf6",
  QUALIFIED: "#10b981",
  PITCHED: "#f59e0b",
  REPLIED: "#06b6d4",
  "FOLLOW-UP": "#f97316",
  MEETING: "#ec4899",
  PROPOSAL: "#6366f1",
  NEGOTIATION: "#eab308",
  WON: "#22c55e",
  LOST: "#ef4444",
};

export const PIPELINE_STAGES = Object.keys(STAGE_COLORS);

export function StageBadge({ stage, className }) {
  const color = STAGE_COLORS[stage] || "#71717a";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide", className)}
      style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
      data-testid={`stage-badge-${stage}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {stage}
    </span>
  );
}

export function DemoBadge({ className }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-amber-400/90 bg-amber-400/10 border border-amber-400/20", className)} data-testid="demo-badge">
      DEMO
    </span>
  );
}

export function ConvBadge({ level }) {
  const map = {
    HIGH: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    MEDIUM: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    LOW: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase border", map[level] || map.MEDIUM)}>
      {level}
    </span>
  );
}

export function ScoreRing({ score = 0, size = 46 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#3b82f6" : "#f59e0b";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth="4" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xs font-semibold" style={{ color }}>{pct}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center fade-up">
      {Icon && <Icon className="h-10 w-10 text-zinc-600 mb-4" />}
      <h3 className="font-head text-lg text-zinc-300">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-zinc-500 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-head text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function initialsFrom(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
