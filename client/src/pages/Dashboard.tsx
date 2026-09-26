import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PaymentModal } from "@/components/PaymentModal";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Download,
  FileAudio,
  FileVideo,
  History,
  LayoutDashboard,
  Loader2,
  Save,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "history", label: "Download history", icon: History },
  { id: "settings", label: "Preferences", icon: Settings2 },
  { id: "pricing", label: "Upgrade to Pro", icon: Crown },
] as const;

type View = (typeof tabs)[number]["id"];

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function UsageMeter({ label, value, limit, accent }: { label: string; value: number; limit: number; accent: string }) {
  const percent = Math.min(100, Math.round((value / limit) * 100));
  return <div><div className="flex items-center justify-between text-xs font-bold text-[#73757e] dark:text-[#b7bac6]"><span>{label}</span><span className="text-[#111318] dark:text-white">{value} / {limit}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eeefe9] dark:bg-white/10"><div className={`h-full rounded-full ${accent}`} style={{ width: `${percent}%` }} /></div></div>;
}

export default function Dashboard() {
  return <DashboardLayout><DashboardContent /></DashboardLayout>;
}

function DashboardContent() {
  const [location, setLocation] = useLocation();
  const overview = trpc.account.overview.useQuery();
  const history = trpc.account.history.useQuery();
  const status = trpc.billing.status.useQuery();
  const utils = trpc.useUtils();
  const updatePreferences = trpc.account.preferences.update.useMutation({ onSuccess: () => { utils.account.overview.invalidate(); toast.success("Preferences saved"); } });
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState("mp4");
  const [preferredQuality, setPreferredQuality] = useState("720p");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const view = useMemo<View>(() => {
    const requested = new URLSearchParams(location.split("?")[1] ?? "").get("view") as View | null;
    return tabs.some((tab) => tab.id === requested) ? requested! : "overview";
  }, [location]);

  useEffect(() => {
    if (!overview.data?.preferences) return;
    setDefaultFormat(overview.data.preferences.defaultFormat);
    setPreferredQuality(overview.data.preferences.preferredQuality);
    setTheme(overview.data.preferences.theme);
  }, [overview.data?.preferences]);

  function selectView(next: View) { setLocation(next === "overview" ? "/dashboard" : `/dashboard?view=${next}`); }

  if (overview.isLoading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-[#5e5ce6]" /></div>;
  if (overview.error || !overview.data) return <div className="mx-auto max-w-lg rounded-3xl border border-[#edc1bc] bg-[#fff8f7] p-8 text-[#7f3f3a]"><CircleAlert /><h2 className="mt-4 text-xl font-black">Dashboard unavailable</h2><p className="mt-2 text-sm">Please sign in again and retry.</p></div>;

  const { user, usage, preferences, plans } = overview.data;
  const recent = history.data?.slice(0, 4) ?? [];
  const isPro = user.plan === "pro";

  return <div className="min-h-[calc(100vh-2rem)] bg-[#f7f7f2] text-[#111318] dark:bg-[#111318] dark:text-[#f7f7f2]">
    <div className="mx-auto max-w-7xl px-2 pb-12 sm:px-5 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e4e5de] py-5 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#5e5ce6]">CBdrop account</p><h1 className="mt-1 text-2xl font-black tracking-[-0.06em]">Your workspace</h1></div><div className="flex items-center gap-2 rounded-full border border-[#e4e5de] bg-white px-3 py-2 text-xs font-black dark:border-white/10 dark:bg-[#1a1c22]"><span className={`size-2 rounded-full ${isPro ? "bg-[#d8ef54]" : "bg-[#b7b8bf]"}`} />{isPro ? "Pro plan" : "Free plan"}<ChevronRight size={14} className="text-[#a1a2aa]" /></div></div>
      <div className="flex gap-2 overflow-x-auto border-b border-[#e4e5de] py-3 dark:border-white/10">{tabs.map((tab) => <button key={tab.id} onClick={() => selectView(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black transition ${view === tab.id ? "bg-[#111318] text-white dark:bg-white dark:text-[#111318]" : "text-[#73757e] hover:bg-white dark:text-[#b7bac6] dark:hover:bg-white/10"}`}><tab.icon size={14} />{tab.label}</button>)}</div>

      {view === "overview" && <div className="space-y-7 pt-8"><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="relative overflow-hidden rounded-[28px] bg-[#111318] p-7 text-white shadow-[0_22px_55px_rgba(17,18,24,0.13)] sm:p-9"><div className="absolute -right-20 -top-24 size-72 rounded-full bg-[#5e5ce6]/50 blur-3xl" /><div className="absolute -bottom-32 left-20 size-64 rounded-full bg-[#d8ef54]/20 blur-3xl" /><div className="relative"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-[#d8ef54]"><Sparkles size={14} />Welcome back</div><h2 className="mt-4 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.08em] sm:text-5xl">{user.name?.split(" ")[0] || "Creator"}, keep the good stuff moving.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-white/65">Your saved workflow is ready. Analyze a new link from the homepage or review the handoffs you have already prepared.</p><a href="/#top" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#d8ef54] px-4 py-2.5 text-sm font-black text-[#29310b] transition hover:bg-[#cce446]">Analyze new URL <ArrowUpRight size={15} /></a></div></div><div className="rounded-[28px] border border-[#e3e4dd] bg-white p-7 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#5e5ce6]">Monthly usage</p><h2 className="mt-2 text-2xl font-black tracking-[-0.06em]">{usage.analyses + usage.downloads} actions</h2></div><div className="flex size-11 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5e5ce6] dark:bg-[#292741]"><Zap size={20} /></div></div><div className="mt-8 space-y-5"><UsageMeter label="Analyses" value={usage.analyses} limit={usage.analysisLimit} accent="bg-[#5e5ce6]" /><UsageMeter label="Downloads" value={usage.downloads} limit={usage.downloadLimit} accent="bg-[#d8ef54]" /></div>{!isPro && <button onClick={() => selectView("pricing")} className="mt-7 text-xs font-black text-[#5e5ce6] hover:underline">Need more room? See Pro <ArrowUpRight size={13} className="inline" /></button>}</div></div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-[28px] border border-[#e3e4dd] bg-white p-7 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#5e5ce6]">Recent handoffs</p><h2 className="mt-2 text-2xl font-black tracking-[-0.06em]">Download history</h2></div><button onClick={() => selectView("history")} className="text-xs font-black text-[#5e5ce6]">View all <ArrowUpRight size={13} className="inline" /></button></div><HistoryList items={recent} emptyLabel="Your completed downloads will appear here." /></div><div className="rounded-[28px] border border-[#e3e4dd] bg-[#f0efff] p-7 text-[#111318] dark:border-white/10 dark:bg-[#292741] dark:text-white"><Crown className="text-[#5e5ce6]" size={23} /><h2 className="mt-5 text-2xl font-black leading-tight tracking-[-0.06em]">{isPro ? "You are on Pro." : "Make more room for momentum."}</h2><p className="mt-3 text-sm leading-6 text-[#666875] dark:text-[#c4c4da]">{isPro ? "Priority processing and higher limits are active on this account." : "Upgrade for 1,000 monthly analyses, 1,000 downloads, and a calmer workflow."}</p>{!isPro && <button onClick={() => selectView("pricing")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#5e5ce6] px-4 py-2.5 text-sm font-black text-white">See Pro <ArrowUpRight size={15} /></button>}</div></div></div>}

      {view === "history" && <div className="pt-8"><SectionHeading eyebrow="Your files" title="Download history" description="Every completed handoff is kept here for your account." /><div className="mt-6 rounded-[28px] border border-[#e3e4dd] bg-white p-5 dark:border-white/10 dark:bg-[#1a1c22]"><HistoryList items={history.data ?? []} emptyLabel="No download history yet. Analyze a URL from the homepage to create your first handoff." detailed /></div></div>}

      {view === "settings" && <div className="pt-8"><SectionHeading eyebrow="Saved preferences" title="Make the next one feel like yours" description="These defaults are saved to your account and used as the starting point for future format selections." /><div className="mt-6 max-w-2xl rounded-[28px] border border-[#e3e4dd] bg-white p-7 dark:border-white/10 dark:bg-[#1a1c22]"><div className="grid gap-6 sm:grid-cols-2"><label className="text-sm font-black">Default format<select value={defaultFormat} onChange={(event) => setDefaultFormat(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#e1e2da] bg-[#fbfbf8] px-3 text-sm font-semibold outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-white/5"><option value="mp4">MP4 video</option><option value="mp3">MP3 audio</option></select></label><label className="text-sm font-black">Preferred quality<select value={preferredQuality} onChange={(event) => setPreferredQuality(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#e1e2da] bg-[#fbfbf8] px-3 text-sm font-semibold outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-white/5"><option value="720p">720p HD</option><option value="480p">480p balanced</option><option value="audio">Audio only</option></select></label><label className="text-sm font-black">Appearance<select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)} className="mt-2 h-12 w-full rounded-2xl border border-[#e1e2da] bg-[#fbfbf8] px-3 text-sm font-semibold outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-white/5"><option value="system">Use system setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="mt-8 flex items-center justify-between gap-4 border-t border-[#ecece7] pt-6 dark:border-white/10"><p className="text-xs leading-5 text-[#85878e]">Current defaults: {preferences.defaultFormat.toUpperCase()} · {preferences.preferredQuality}</p><button onClick={() => updatePreferences.mutate({ defaultFormat: defaultFormat as "mp4" | "mp3", preferredQuality: preferredQuality as "720p" | "480p" | "audio", theme })} disabled={updatePreferences.isPending} className="inline-flex items-center gap-2 rounded-full bg-[#5e5ce6] px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Save size={15} />{updatePreferences.isPending ? "Saving..." : "Save preferences"}</button></div></div></div>}

      {view === "pricing" && <div className="pt-8"><SectionHeading eyebrow="Premium plans" title="Choose your pace" description="Start free, then upgrade when your workflow deserves more headroom." /><div className="mt-7 grid gap-5 lg:grid-cols-2">{plans.map((plan) => { const active = plan.id === user.plan; return <div key={plan.id} className={`relative rounded-[28px] border p-7 ${plan.id === "pro" ? "border-[#5e5ce6] bg-[#f0efff] dark:bg-[#292741]" : "border-[#e3e4dd] bg-white dark:border-white/10 dark:bg-[#1a1c22]"}`}>{plan.id === "pro" && <span className="absolute right-6 top-6 rounded-full bg-[#d8ef54] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#53630f]">Recommended</span>}<div className="flex items-center gap-3"><span className={`flex size-11 items-center justify-center rounded-2xl ${plan.id === "pro" ? "bg-[#5e5ce6] text-white" : "bg-[#f0f0ed] text-[#73757e] dark:bg-white/10"}`}>{plan.id === "pro" ? <Crown size={21} /> : <Download size={20} />}</span><div><h3 className="text-xl font-black tracking-[-0.05em]">{plan.name}</h3><p className="text-xs font-semibold text-[#85878e]">{plan.description}</p></div></div><div className="mt-7 flex items-end gap-1"><span className="text-5xl font-black tracking-[-0.09em]">${plan.price}</span><span className="pb-2 text-sm font-bold text-[#85878e]">/{plan.interval}</span></div><ul className="mt-7 grid gap-3">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-sm font-semibold text-[#60626b] dark:text-[#d0d1dc]"><span className="flex size-5 items-center justify-center rounded-full bg-[#d8ef54] text-[#596b0c]"><Check size={12} strokeWidth={3} /></span>{feature}</li>)}</ul>{active ? <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#cfd0c8] px-4 py-2.5 text-sm font-black text-[#73757e] dark:border-white/10"><Check size={15} />Current plan</div> : <button onClick={() => setIsPaymentOpen(true)} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#5e5ce6] px-4 py-2.5 text-sm font-black text-white hover:bg-[#4d4acb] transition shadow-md"><ArrowUpRight size={15} />Upgrade to Pro</button>}</div>; })}</div><div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e3e4dd] bg-white p-5 text-xs leading-5 text-[#777982] dark:border-white/10 dark:bg-[#1a1c22]"><CircleAlert size={16} className="mt-0.5 shrink-0 text-[#5e5ce6]" /><p>CBdrop Pro supports Instant Checkout via Card, PayPal, or Crypto. Upgrades take effect immediately on your account without requiring external redirects.</p></div></div>}
    </div>
    <PaymentModal isOpen={isPaymentOpen} onClose={() => { setIsPaymentOpen(false); utils.account.overview.invalidate(); }} />
  </div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#5e5ce6]">{eyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.08em]">{title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#777982] dark:text-[#b7bac6]">{description}</p></div>;
}

function HistoryList({ items, emptyLabel, detailed = false }: { items: Array<{ id: number; platform: string; title: string; creator: string | null; quality: string; container: string; status: string; createdAt: Date | string; filename: string | null }>; emptyLabel: string; detailed?: boolean }) {
  if (items.length === 0) return <div className="flex flex-col items-center justify-center py-14 text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5e5ce6] dark:bg-[#292741]"><History size={21} /></div><p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-[#85878e]">{emptyLabel}</p></div>;
  return <div className="mt-6 divide-y divide-[#ecece7] dark:divide-white/10">{items.map((item) => <div key={item.id} className={`flex flex-col justify-between gap-3 py-4 first:pt-0 sm:flex-row sm:items-center ${detailed ? "sm:gap-8" : ""}`}><div className="flex min-w-0 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.container === "mp3" ? "bg-[#fce6df] text-[#c4614f]" : "bg-[#e7e5ff] text-[#5e5ce6]"}`}>{item.container === "mp3" ? <FileAudio size={17} /> : <FileVideo size={17} />}</span><div className="min-w-0"><p className="truncate text-sm font-black">{item.title}</p><p className="mt-1 truncate text-xs font-semibold text-[#8b8d95]">{item.platform} · {item.container.toUpperCase()} {item.quality} · {formatDate(item.createdAt)}</p></div></div><div className="flex items-center gap-4 pl-[52px] text-xs font-bold text-[#85878e] sm:pl-0"><span className="flex items-center gap-1.5"><Clock3 size={13} />{item.status}</span>{detailed && item.filename && <span className="hidden max-w-[180px] truncate lg:block">{item.filename}</span>}</div></div>)}</div>;
}
