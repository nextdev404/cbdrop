import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { usePro } from "@/contexts/ProContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { AdBanner } from "@/components/AdBanner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Clock3,
  Crown,
  Download,
  FileAudio,
  FileVideo,
  ImageIcon,
  Images,
  Info,
  Link2,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Moon,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { ALL_SEO_TOOLS, type SeoToolPreset } from "@/lib/seoPresets";

function PlatformIcon({ name, size = 14 }: { name: string; size?: number }) {
  switch (name) {
    case "YouTube":
      return (
        <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "TikTok":
      return (
        <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.03 3.33-1.41 3.54-3.2.06-.55.04-1.1.04-1.65V0l-.26.02z" />
        </svg>
      );
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "Snapchat":
      return (
        <svg viewBox="0 0 16 16" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path
            d="M15.943 11.526c-.111-.303-.323-.465-.564-.599a1.416 1.416 0 0 0-.123-.064l-.219-.111c-.752-.399-1.339-.902-1.746-1.498a3.387 3.387 0 0 1-.3-.531c-.034-.1-.032-.156-.008-.207a.338.338 0 0 1 .097-.1c.129-.086.262-.173.352-.231.162-.104.289-.187.371-.245.309-.216.525-.446.66-.702a1.397 1.397 0 0 0 .069-1.16c-.205-.538-.713-.872-1.329-.872a1.829 1.829 0 0 0-.487.065c.006-.368-.002-.757-.035-1.139-.116-1.344-.587-2.048-1.077-2.61a4.294 4.294 0 0 0-1.095-.881C9.764.216 8.92 0 7.999 0c-.92 0-1.76.216-2.505.641-.412.232-.782.53-1.097.883-.49.562-.96 1.267-1.077 2.61-.033.382-.04.772-.036 1.138a1.83 1.83 0 0 0-.487-.065c-.615 0-1.124.335-1.328.873a1.398 1.398 0 0 0 .067 1.161c.136.256.352.486.66.701.082.058.21.14.371.246l.339.221a.38.38 0 0 1 .109.11c.026.053.027.11-.012.217a3.363 3.363 0 0 1-.295.52c-.398.583-.968 1.077-1.696 1.472-.385.204-.786.34-.955.8-.128.348-.044.743.28 1.075.119.125.257.23.409.31a4.43 4.43 0 0 0 1 .4.66.66 0 0 1 .202.09c.118.104.102.26.259.488.079.118.18.22.296.3.33.229.701.243 1.095.258.355.014.758.03 1.217.18.19.064.389.186.618.328.55.338 1.305.802 2.566.802 1.262 0 2.02-.466 2.576-.806.227-.14.424-.26.609-.321.46-.152.863-.168 1.218-.181.393-.015.764-.03 1.095-.258a1.14 1.14 0 0 0 .336-.368c.114-.192.11-.327.217-.42a.625.625 0 0 1 .19-.087 4.446 4.446 0 0 0 .078-.588z"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-white" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      return null;
  }
}

const platformMarks = [
  {
    name: "YouTube",
    badgeBg: "bg-[#ff0000]",
    hoverBorder: "hover:border-[#ff0000]/40 hover:shadow-[0_4px_16px_rgba(255,0,0,0.12)]",
  },
  {
    name: "TikTok",
    badgeBg: "bg-black dark:bg-[#202228]",
    hoverBorder: "hover:border-black/30 dark:hover:border-white/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
  },
  {
    name: "Facebook",
    badgeBg: "bg-[#1877f2]",
    hoverBorder: "hover:border-[#1877f2]/40 hover:shadow-[0_4px_16px_rgba(24,119,242,0.12)]",
  },
  {
    name: "Instagram",
    badgeBg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]",
    hoverBorder: "hover:border-[#dc2743]/40 hover:shadow-[0_4px_16px_rgba(220,39,67,0.12)]",
  },
  {
    name: "Snapchat",
    badgeBg: "bg-[#fffc00]",
    hoverBorder: "hover:border-[#d8ef54]/60 hover:shadow-[0_4px_16px_rgba(216,239,84,0.15)]",
  },
  {
    name: "X",
    badgeBg: "bg-black dark:bg-[#202228]",
    hoverBorder: "hover:border-black/30 dark:hover:border-white/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
  },
] as const;

const steps = [
  ["01", "Paste a social URL", "Drop in a public post URL you have permission to use. CBdrop detects the platform for you."],
  ["02", "Pick your format", "The extractor finds available video, audio, HLS, and DASH formats without relying on the page extension."],
  ["03", "Get your video", "Start a prepared download job and keep moving. No account required for the core flow."],
];

type Format = {
  id: string;
  container: string;
  quality: string;
  type: "video" | "audio" | "image";
  available: boolean;
  size: string;
  filesize?: number;
  note: string;
  downloadUrl?: string;
  videoCodec?: string;
  audioCodec?: string;
  isOriginal?: boolean;
};

type MediaResult = {
  id: string;
  platform: string;
  title: string;
  creator: string;
  duration: string;
  thumbnailUrl?: string;
  ready?: boolean;
  formats: Format[];
};

type JobResult = {
  jobId: string;
  status: "queued" | "processing" | "completed";
  filename: string;
  downloadUrl?: string;
  expiresAt?: string;
  format?: Format | any;
  success?: boolean;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  fileName?: string;
};
type UiStatus = "idle" | "analyzing" | "ready" | "processing" | "completed" | "failed";

function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={`relative inline-flex ${className} shrink-0 items-center justify-center`}>
      <img
        src="/logo-mark.png"
        alt="CBdrop"
        className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(83,79,252,0.28)]"
        loading="eager"
      />
    </span>
  );
}

function PlatformPill({ name, badgeBg, hoverBorder }: (typeof platformMarks)[number]) {
  return (
    <div
      title={name}
      aria-label={name}
      className={`group flex size-9 sm:size-10 items-center justify-center rounded-full border border-[#e5e6df] bg-white/90 shadow-[0_2px_8px_rgba(17,18,24,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${hoverBorder}`}
    >
      <span
        className={`flex size-6 sm:size-7 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm transition-transform duration-200 group-hover:scale-110 ${badgeBg}`}
      >
        <PlatformIcon name={name} size={14} />
      </span>
    </div>
  );
}

function PreviewCard() {
  return <div className="relative mx-auto w-full max-w-[500px] animate-[float_7s_ease-in-out_infinite]">
    <div className="absolute -right-2 top-10 hidden rounded-2xl border border-[#e4e5dc] bg-white px-4 py-3 shadow-[0_20px_60px_rgba(17,18,24,0.12)] sm:block lg:-right-4 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex items-center gap-2 text-xs font-bold text-[#454751] dark:text-[#d9dbe3]"><span className="flex size-6 items-center justify-center rounded-full bg-[#eaf5a4] text-[#4d5b13]"><Check size={13} strokeWidth={3} /></span>Ready in seconds</div></div>
    <div className="absolute -left-2 bottom-8 hidden rounded-2xl border border-[#e4e5dc] bg-white px-4 py-3 shadow-[0_20px_60px_rgba(17,18,24,0.12)] sm:block lg:-left-4 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex items-center gap-2 text-xs font-bold text-[#454751] dark:text-[#d9dbe3]"><span className="flex size-6 items-center justify-center rounded-full bg-[#ecebff] text-[#5e5ce6]"><ShieldCheck size={13} /></span>Permission-first by design</div></div>
    <div className="overflow-hidden rounded-[30px] border border-[#dfe1d8] bg-white p-3 shadow-[0_30px_80px_rgba(34,36,51,0.15)] dark:border-white/10 dark:bg-[#1a1c22]"><div className="relative overflow-hidden rounded-[22px] bg-[#111318] p-5 text-white sm:p-7"><div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#5e5ce6]/40 blur-3xl" /><div className="absolute -bottom-24 left-8 size-48 rounded-full bg-[#d8ef54]/25 blur-3xl" /><div className="relative flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-white/55"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#d8ef54]" />media passport</span><span>01 / 03</span></div><div className="relative mt-14 sm:mt-16 flex items-end justify-between gap-4"><div><p className="text-xs font-medium text-white/55">ANALYZED FROM</p><p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">one link</p></div><div className="flex size-14 sm:size-16 items-center justify-center rounded-[20px] bg-[#5e5ce6] shadow-[0_15px_30px_rgba(94,92,230,0.4)]"><Play size={25} fill="currentColor" strokeWidth={1.5} /></div></div><div className="relative mt-8 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-[11px]"><div><p className="text-white/45">FORMAT</p><p className="mt-1 font-bold">MP4</p></div><div><p className="text-white/45">QUALITY</p><p className="mt-1 font-bold">720p</p></div><div><p className="text-white/45">STATUS</p><p className="mt-1 font-bold text-[#d8ef54]">AVAILABLE</p></div></div></div><div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4 sm:px-3"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-[#f0f0ed] text-[#5e5ce6] dark:bg-white/10"><Link2 size={15} /></span><span className="text-xs font-semibold text-[#676a73] dark:text-[#b8bbc6]">cbdrop / analyze</span></div><span className="flex items-center gap-1.5 text-xs font-bold text-[#5e5ce6]"><Zap size={13} fill="currentColor" />instant</span></div></div>
  </div>;
}

function ImageCard({
  format,
  index,
  total,
  onDownload,
  onPreview,
  isDownloading,
  disabled,
}: {
  format: Format;
  index?: number;
  total?: number;
  onDownload: () => void;
  onPreview?: () => void;
  isDownloading: boolean;
  disabled?: boolean;
}) {
  const isMulti = typeof index === "number" && (total ?? 1) > 1;
  const slideImgSrc = format.downloadUrl
    ? `/api/thumbnail-proxy?url=${encodeURIComponent(format.downloadUrl)}`
    : "";

  return (
    <div
      className={`group flex flex-col justify-between overflow-hidden rounded-[20px] border border-[#dedfd8] bg-white p-2.5 shadow-[0_4px_18px_rgba(36,38,51,0.04)] transition hover:-translate-y-1 hover:border-[#5e5ce6]/40 hover:shadow-[0_12px_32px_rgba(36,38,51,0.10)] dark:border-white/10 dark:bg-[#1a1c22] ${
        !isMulti ? "mx-auto w-full max-w-md sm:max-w-lg p-4" : ""
      }`}
    >
      <div
        onClick={onPreview}
        className={`relative w-full overflow-hidden rounded-[14px] bg-[#111318] ${
          onPreview ? "cursor-pointer" : ""
        } ${
          isMulti ? "aspect-[3/4]" : "min-h-[260px] max-h-[500px] flex items-center justify-center"
        }`}
        title={onPreview ? "Click to view full size" : undefined}
      >
        {isMulti && (
          <div className="absolute left-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-black/80 text-[11px] font-black text-white shadow-md backdrop-blur-md border border-white/20">
            {index + 1}
          </div>
        )}

        <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-black/75 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#d8ef54] backdrop-blur-md border border-white/15">
          {format.quality && format.quality !== "source" && format.quality !== "original" ? format.quality : "HD"}
        </span>

        {onPreview && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/75 text-white shadow-lg backdrop-blur-md border border-white/20">
              <Maximize2 size={16} />
            </span>
          </div>
        )}

        <img
          src={slideImgSrc}
          alt={isMulti ? `Image ${index + 1}` : "Image preview"}
          className={`w-full transition-transform duration-500 group-hover:scale-105 ${
            !isMulti ? "max-h-[480px] object-contain" : "h-full object-cover"
          }`}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (!target.dataset.failedOnce && format.downloadUrl) {
              target.dataset.failedOnce = "1";
              target.src = format.downloadUrl;
            }
          }}
        />
      </div>

      <div className="mt-2.5 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          disabled={isDownloading || disabled}
          className="flex h-9 sm:h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#5e5ce6] px-3 text-xs font-black text-white shadow-[0_4px_14px_rgba(94,92,230,0.22)] transition hover:bg-[#504ed1] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {isDownloading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download size={14} strokeWidth={2.5} />
              <span>Download</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-between px-0.5 text-[10px] font-semibold text-[#85878e] dark:text-[#a0a3af]">
          <span>{isMulti ? `Photo ${index + 1} of ${total}` : "Original Resolution"}</span>
          <span className="font-bold text-[#5e5ce6] dark:text-[#d8ef54]">
            {format.container.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ActiveDownload {
  token: string;
  downloadUrl: string;
  filename: string;
  quality: string;
  container: string;
  status: "idle" | "preparing" | "downloading" | "resuming" | "interrupted" | "completed" | "error";
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  error?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : i === 1 ? 1 : 2)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatETA(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `~${hours}h ${mins % 60}m left`;
  }
  return `~${mins}m ${secs > 0 ? `${secs}s` : ""} left`;
}

export default function Home({ preset }: { preset?: SeoToolPreset } = {}) {
  const [url, setUrl] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const { isPro, openUpgradeModal, proKey } = usePro();
  const { user, openAuthModal, logout } = useAuthContext();
  const [status, setStatus] = useState<UiStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (preset) {
      document.title = preset.title;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", preset.metaDescription);
    } else {
      document.title = "CBdrop";
    }
  }, [preset]);

  // When the user loads or refreshes the site, always show the URL input place at the top
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Scroll to the very top immediately
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    // Clean up any anchor hash like #results from previous interaction
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // Ensure the input place is visible and focused
    const timer = window.setTimeout(() => {
      window.scrollTo(0, 0);
      inputRef.current?.focus({ preventScroll: true });
    }, 60);

    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  function isFormatPro(format: Format) {
    const q = format.quality.toLowerCase();
    return q.includes("4k") || q.includes("2160") || q.includes("1440") || q.includes("1080p60") || q.includes("320");
  }
  const [media, setMedia] = useState<MediaResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [formatCategory, setFormatCategory] = useState<"all" | "video" | "audio" | "image">("all");
  const [job, setJob] = useState<JobResult | null>(null);
  const [downloadingSlideId, setDownloadingSlideId] = useState<string | null>(null);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [visibleCount, setVisibleCount] = useState(4);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [activeDownload, setActiveDownload] = useState<ActiveDownload | null>(null);

  useEffect(() => {
    if (!activeDownload || activeDownload.status === "completed" || activeDownload.status === "error") {
      return;
    }
    const token = activeDownload.token;
    let isMounted = true;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/download-progress/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        setActiveDownload((prev) => {
          if (!prev || prev.token !== token) return prev;
          if (data.status && data.status !== "idle") {
            return {
              ...prev,
              status: data.status,
              downloadedBytes: data.downloadedBytes ?? prev.downloadedBytes,
              totalBytes: data.totalBytes > 0 ? data.totalBytes : prev.totalBytes,
              speed: data.speed ?? prev.speed,
              eta: data.eta ?? prev.eta,
              error: data.error,
            };
          }
          return prev;
        });

        if (data.status === "completed") {
          clearInterval(pollInterval);
        }
      } catch {}
    }, 500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeDownload?.token, activeDownload?.status]);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledMediaIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const analyze = trpc.media.analyze.useMutation();
  const refreshMedia = trpc.media.refresh.useMutation();
  const createJob = trpc.media.createJob.useMutation();
  const createZipJob = trpc.media.createZipJob.useMutation();
  const refreshJob = trpc.media.refreshJob.useMutation();
  const cookiesStatus = trpc.media.getCookiesStatus.useQuery();
  const saveCookiesMutation = trpc.media.saveCookies.useMutation();
  const clearCookiesMutation = trpc.media.clearCookies.useMutation();
  const selected = media?.formats.find((format) => format.id === selectedFormat);
  const isSelectedJobCompleted = Boolean(
    status === "completed" &&
    job &&
    selected &&
    (job.format?.id === selected.id || (!job.format && job.filename?.includes(selected.quality))) &&
    job.downloadUrl
  );

  function handleSelectFormat(formatId: string) {
    if (formatId === selectedFormat) return;
    setSelectedFormat(formatId);
    setJob(null);
    if (status === "completed") {
      setStatus("ready");
    }
  }

  function handleCategoryChange(catId: "all" | "video" | "audio" | "image") {
    setFormatCategory(catId);
    if (!media || catId === "all") return;
    const matching = media.formats.filter((f) => f.type === catId);
    if (matching.length > 0) {
      const isCurrentMatching = matching.some((f) => f.id === selectedFormat);
      if (!isCurrentMatching) {
        setSelectedFormat(matching[0].id);
        setJob(null);
        if (status === "completed") {
          setStatus("ready");
        }
      }
    }
  }

  const imageFormats = useMemo(() => media?.formats.filter((f) => f.type === "image") ?? [], [media]);
  const audioFormats = useMemo(() => media?.formats.filter((f) => f.type === "audio") ?? [], [media]);
  const videoFormats = useMemo(() => media?.formats.filter((f) => f.type === "video") ?? [], [media]);
  const hasVideo = videoFormats.length > 0;
  const isSingleImage = !hasVideo && imageFormats.length === 1;
  const isMultiImage = !hasVideo && imageFormats.length > 1;

  const availableCategories = useMemo(() => {
    if (!media) return [];
    const cats: { id: "all" | "video" | "audio" | "image"; label: string; count: number }[] = [
      { id: "all", label: "All", count: media.formats.length },
    ];
    if (videoFormats.length > 0) cats.push({ id: "video", label: "Video", count: videoFormats.length });
    if (audioFormats.length > 0) cats.push({ id: "audio", label: "Audio", count: audioFormats.length });
    if (imageFormats.length > 0) cats.push({ id: "image", label: "Images", count: imageFormats.length });
    return cats;
  }, [media, videoFormats, audioFormats, imageFormats]);

  const filteredFormats = useMemo(() => {
    if (!media) return [];
    if (formatCategory === "all") return media.formats;
    const subset = media.formats.filter((f) => f.type === formatCategory);
    return subset.length > 0 ? subset : media.formats;
  }, [media, formatCategory]);

  const displayedImages = useMemo(() => imageFormats.slice(0, visibleCount), [imageFormats, visibleCount]);
  const remainingImages = Math.max(0, imageFormats.length - visibleCount);

  function triggerFileDownload(downloadUrl: string, filename: string) {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename || (selected?.type === "image" ? "image.jpg" : "video.mp4"));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleDownloadSlide(format: Format, index: number) {
    if (!media) return;
    setDownloadingSlideId(format.id);
    try {
      const result = await createJob.mutateAsync({
        mediaId: media.id,
        formatId: format.id,
        sourceUrl: url.trim(),
      });
      if (result.downloadUrl) {
        const isMulti = imageFormats.length > 1;
        const defaultName = format.type === "audio" ? `audio.${format.container}` : (isMulti ? `image-${index + 1}.${format.container}` : `image.${format.container}`);
        const filename = result.filename || defaultName;
        const tokenMatch = result.downloadUrl.match(/\/api\/download\/([^/?#]+)/);
        const token = tokenMatch ? tokenMatch[1] : undefined;
        if (token) {
          setActiveDownload({
            token,
            downloadUrl: result.downloadUrl,
            filename,
            quality: format.quality,
            container: format.container.toUpperCase(),
            status: "downloading",
            downloadedBytes: 0,
            totalBytes: format.filesize || 0,
            speed: 0,
            eta: 0,
          });
        }
        triggerFileDownload(result.downloadUrl, filename);
        toast.success(format.type === "audio" ? "Audio track downloaded" : (isMulti ? `Image ${index + 1} downloaded` : "Image downloaded"));
      } else {
        toast.error("Download URL was not generated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download media");
    } finally {
      setDownloadingSlideId(null);
    }
  }

  async function handleDownloadAll() {
    if (!media || !imageFormats.length) return;

    // Option A (Preferred): Package all images into a single ZIP file
    setIsZipping(true);
    try {
      const zipResult = await createZipJob.mutateAsync({
        mediaId: media.id,
        sourceUrl: url.trim(),
      });
      if (zipResult.downloadUrl) {
        triggerFileDownload(zipResult.downloadUrl, zipResult.filename || "cbdrop-images.zip");
        toast.success(`Downloading all ${imageFormats.length} images as ZIP archive`);
        setIsZipping(false);
        return;
      }
    } catch (err) {
      console.warn("ZIP packaging failed, proceeding with sequential download fallback:", err);
    } finally {
      setIsZipping(false);
    }

    // Option B: Sequential downloads with progress indicator
    setDownloadAllProgress({ current: 0, total: imageFormats.length });
    let count = 0;

    for (let i = 0; i < imageFormats.length; i++) {
      const format = imageFormats[i];
      try {
        const result = await createJob.mutateAsync({
          mediaId: media.id,
          formatId: format.id,
          sourceUrl: url.trim(),
        });
        if (result.downloadUrl) {
          const filename = result.filename || `image-${i + 1}.${format.container}`;
          triggerFileDownload(result.downloadUrl, filename);
          count++;
          setDownloadAllProgress({ current: count, total: imageFormats.length });
        }
      } catch {
        // continue with next image, do not abort
      }
      if (i < imageFormats.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    setDownloadAllProgress(null);
    toast.success(`Downloaded ${count} of ${imageFormats.length} images`);
  }

  useEffect(() => {
    if (previewIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewIndex(null);
      if (e.key === "ArrowLeft") setPreviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : imageFormats.length - 1));
      if (e.key === "ArrowRight") setPreviewIndex((prev) => (prev !== null && prev < imageFormats.length - 1 ? prev + 1 : 0));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, imageFormats.length]);

  useEffect(() => {
    if (!media || media.ready !== false || status !== "processing") return;
    const timer = window.setInterval(() => refreshMedia.mutate({ mediaId: media.id }, { onSuccess: (result) => { setMedia(result); if (result.ready) { setSelectedFormat(result.formats[0]?.id ?? ""); setStatus("ready"); toast.success("Media processing finished"); } } }), 4000);
    return () => window.clearInterval(timer);
  }, [media, refreshMedia, status]);

  useEffect(() => {
    if (!job || job.status === "completed" || status !== "processing") return;
    const timer = window.setInterval(
      () =>
        refreshJob.mutate(
          { jobId: job.jobId, formatId: selected?.id ?? "mp4" },
          {
            onSuccess: (result) => {
              setJob(result);
              if (result.status === "completed") {
                setStatus("completed");
                toast.success(selected?.type === "image" ? "Your image is ready to download" : "Your file is ready to download");
                if (result.downloadUrl) {
                  triggerFileDownload(result.downloadUrl, result.filename);
                }
              }
            },
          }
        ),
      4000
    );
    return () => window.clearInterval(timer);
  }, [job, refreshJob, selected, status]);

  useEffect(() => {
    const isReady = Boolean(media && (status === "ready" || status === "processing" || status === "completed"));
    if (isReady && media?.id && media.id !== lastScrolledMediaIdRef.current) {
      lastScrolledMediaIdRef.current = media.id;
      const timer = window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [media, status]);

  function handleAnalyzeWithUrl(targetText: string) {
    const trimmed = targetText.trim();
    if (!trimmed) {
      setStatus("failed");
      setError("Paste a YouTube, TikTok, Instagram, Facebook, Snapchat, or X URL to get started.");
      return;
    }
    setError("");
    setJob(null);
    setActiveDownload(null);
    lastScrolledMediaIdRef.current = null;
    setStatus("analyzing");

    analyze.mutate(
      { url: trimmed },
      {
        onSuccess: (result) => {
          setVisibleCount(4);
          setMedia(result);
          setSelectedFormat(result.formats[0]?.id ?? "");
          setStatus(result.ready === false ? "processing" : "ready");
        },
        onError: (mutationError) => {
          setStatus("failed");
          const msg = mutationError.message || "";
          const lower = msg.toLowerCase();
          if (
            lower.includes("json") ||
            lower.includes("failed to execute") ||
            lower.includes("fetch") ||
            lower.includes("unexpected end") ||
            lower.includes("network")
          ) {
            setError("The server is temporarily busy or reconnecting. Please wait a moment and try again.");
          } else {
            setError(msg || "We couldn't process this URL. Check the link and try again.");
          }
        },
      }
    );
  }

  function triggerAutoAnalyze(pastedText: string) {
    const clean = pastedText.trim().replace(/^["']|["']$/g, "");
    if (!clean) return;
    setUrl(clean);
    handleAnalyzeWithUrl(clean);
  }

  useEffect(() => {
    function handleGlobalPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isContentEditable = target?.isContentEditable;
      if (
        (tagName === "input" && target !== inputRef.current) ||
        tagName === "textarea" ||
        isContentEditable
      ) {
        return;
      }

      // If user pasted directly into the URL input, onPaste handles it
      if (target === inputRef.current) {
        return;
      }

      const pastedText = event.clipboardData?.getData("text");
      if (!pastedText) return;
      const clean = pastedText.trim();
      if (!clean) return;

      if (
        /^(https?:\/\/|www\.|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/)/i.test(clean) ||
        clean.startsWith("<")
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        triggerAutoAnalyze(clean);
      }
    }

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAnalyzeWithUrl(url);
  }

  function handleDownload() {
    if (!media || !selected) return;
    setStatus("processing");
    createJob.mutate(
      { mediaId: media.id, formatId: selected.id, sourceUrl: url.trim() },
      {
        onSuccess: (result) => {
          setJob(result);
          setStatus(result.status === "completed" ? "completed" : "processing");
          toast(result.status === "completed" ? "Your file is ready" : (selected.type === "image" ? "Preparing your image download" : "Preparing your media download"), {
            description: `${selected.container.toUpperCase()} · ${selected.quality} · ${selected.size}`,
          });
          if (result.status === "completed" && result.downloadUrl) {
            const tokenMatch = result.downloadUrl.match(/\/api\/download\/([^/?#]+)/);
            const token = tokenMatch ? tokenMatch[1] : undefined;
            if (token) {
              setActiveDownload({
                token,
                downloadUrl: result.downloadUrl,
                filename: result.filename,
                quality: selected.quality,
                container: selected.container.toUpperCase(),
                status: "downloading",
                downloadedBytes: 0,
                totalBytes: selected.filesize || 0,
                speed: 0,
                eta: 0,
              });
            }
            triggerFileDownload(result.downloadUrl, result.filename);
          }
        },
        onError: (mutationError) => {
          setStatus("failed");
          setError(mutationError.message || "We couldn't prepare that download. Please try again.");
        },
      }
    );
  }

  function downloadManifest() {
    if (!job || !selected) return;
    if (job.format && job.format.id !== selected.id) {
      handleDownload();
      return;
    }
    if (job.downloadUrl) {
      const filename = job.filename || (selected.type === "image" ? "image.jpg" : "video.mp4");
      const tokenMatch = job.downloadUrl.match(/\/api\/download\/([^/?#]+)/);
      const token = tokenMatch ? tokenMatch[1] : undefined;
      if (token) {
        setActiveDownload({
          token,
          downloadUrl: job.downloadUrl,
          filename,
          quality: selected.quality,
          container: selected.container.toUpperCase(),
          status: "downloading",
          downloadedBytes: 0,
          totalBytes: selected.filesize || 0,
          speed: 0,
          eta: 0,
        });
      }
      triggerFileDownload(job.downloadUrl, filename);
      return;
    }
    const blob = new Blob([`CBdrop MVP handoff\nJob: ${job.jobId}\nFormat: ${selected.container.toUpperCase()} · ${selected.quality}\nSize: ${selected.size}\n\nThis sample manifest confirms the download workflow. Connect an approved platform adapter to replace it with permitted media bytes.`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = job.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function resetAnalyzer() { lastScrolledMediaIdRef.current = null; setStatus("idle"); setMedia(null); setJob(null); setActiveDownload(null); setError(""); setSelectedFormat(""); setFormatCategory("all"); setVisibleCount(4); }

  return <div className="min-h-screen overflow-x-hidden bg-[#f7f7f2] text-[#111318] transition-colors duration-200 dark:bg-[#111318] dark:text-[#f7f7f2]">
    <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:url('data:image/svg+xml,%3Csvg viewBox=\'0 0 160 160\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.7\'/%3E%3C/svg%3E')]" />
    <header className="relative z-20 border-b border-[#e4e5de] bg-[#f7f7f2]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#111318]/90">
      <div className="container flex h-[76px] items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group" aria-label="CBdrop home">
          <img
            src="/logo.png"
            alt="CBdrop"
            className="h-9 w-auto object-contain dark:hidden transition-transform duration-200 group-hover:scale-[1.02]"
            loading="eager"
          />
          <img
            src="/logo-dark.png"
            alt="CBdrop"
            className="h-9 w-auto object-contain hidden dark:block transition-transform duration-200 group-hover:scale-[1.02]"
            loading="eager"
          />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#686b75] md:flex dark:text-[#b7bac6]"><a className="transition-colors hover:text-[#5e5ce6]" href="#tools">Free Tools</a><a className="transition-colors hover:text-[#5e5ce6]" href="#how-it-works">How it works</a><a className="transition-colors hover:text-[#5e5ce6]" href="#platforms">Supported platforms</a><a className="transition-colors hover:text-[#5e5ce6]" href="#faq">FAQ</a></nav><div className="hidden items-center gap-3 md:flex"><button aria-label="Toggle theme" className="flex size-10 items-center justify-center rounded-full border border-[#e1e2da] text-[#6a6c75] transition hover:border-[#5e5ce6] hover:text-[#5e5ce6] dark:border-white/10 dark:text-[#b7bac6]" onClick={() => toggleTheme?.()}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>{isPro ? (
  <button
    type="button"
    onClick={openUpgradeModal}
    className="inline-flex items-center gap-1.5 rounded-full border border-[#d8ef54]/60 bg-[#d8ef54]/15 px-3 py-1.5 text-xs font-black text-[#596b0c] transition hover:bg-[#d8ef54]/25 dark:text-[#d8ef54]"
  >
    <Crown size={14} className="text-[#5e5ce6] dark:text-[#d8ef54]" />
    <span>PRO</span>
  </button>
) : (
  <button
    type="button"
    onClick={openUpgradeModal}
    className="group inline-flex items-center gap-1.5 rounded-full border border-[#5e5ce6]/40 bg-[#5e5ce6]/10 px-3.5 py-1.5 text-xs font-black text-[#5e5ce6] transition hover:bg-[#5e5ce6] hover:text-white dark:border-[#d8ef54]/40 dark:bg-[#d8ef54]/10 dark:text-[#d8ef54] dark:hover:bg-[#d8ef54] dark:hover:text-[#111318]"
  >
    <Crown size={14} />
    <span>Upgrade</span>
  </button>
)}{user ? (
  <div className="flex items-center gap-2">
    <a
      href="/dashboard"
      className="group inline-flex items-center gap-2 rounded-full border border-[#dedfd8] bg-white px-3.5 py-1.5 text-xs font-bold text-[#111318] shadow-xs transition hover:border-[#5e5ce6] dark:border-white/10 dark:bg-white/5 dark:text-white"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-[#5e5ce6] text-[10px] font-black text-white">
        {user.name ? user.name[0].toUpperCase() : "U"}
      </span>
      <span>{user.name ? user.name.split(" ")[0] : "Account"}</span>
    </a>
    <button
      type="button"
      onClick={() => logout()}
      title="Sign out"
      className="flex size-8 items-center justify-center rounded-full border border-[#dedfd8] bg-white text-xs font-bold text-[#767882] transition hover:text-[#bd554c] dark:border-white/10 dark:bg-white/5"
    >
      <LogOut size={13} />
    </button>
  </div>
) : (
  <button
    type="button"
    onClick={openAuthModal}
    className="group inline-flex items-center gap-2 rounded-full bg-[#111318] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#5e5ce6] active:scale-[0.97] dark:bg-white dark:text-[#111318] dark:hover:bg-[#d8ef54]"
  >
    Sign in <ArrowUpRight size={15} />
  </button>
)}</div><button className="flex size-10 items-center justify-center rounded-full border border-[#e1e2da] md:hidden dark:border-white/10" aria-label="Open navigation" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button></div>{mobileOpen && <div className="container border-t border-[#e4e5de] py-4 md:hidden dark:border-white/10"><div className="flex flex-col gap-4 text-sm font-semibold text-[#686b75] dark:text-[#b7bac6]"><a href="#tools" onClick={() => setMobileOpen(false)}>Free Tools</a><a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a><a href="#platforms" onClick={() => setMobileOpen(false)}>Supported platforms</a><a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a><div className="flex items-center gap-4 border-t border-[#e4e5de] pt-4 dark:border-white/10"><button onClick={() => toggleTheme?.()} className="flex items-center gap-2">{dark ? <Sun size={16} /> : <Moon size={16} />} Theme</button>{isPro ? (
  <button
    type="button"
    onClick={() => { setMobileOpen(false); openUpgradeModal(); }}
    className="inline-flex items-center gap-1.5 text-xs font-black text-[#5e5ce6] dark:text-[#d8ef54]"
  >
    <Crown size={14} /> PRO ACTIVE
  </button>
) : (
  <button
    type="button"
    onClick={() => { setMobileOpen(false); openUpgradeModal(); }}
    className="inline-flex items-center gap-1.5 text-xs font-black text-[#5e5ce6] dark:text-[#d8ef54]"
  >
    <Crown size={14} /> Upgrade to Pro
  </button>
)}{user ? (
  <div className="flex items-center gap-3">
    <a
      href="/dashboard"
      onClick={() => setMobileOpen(false)}
      className="text-xs font-bold text-[#111318] dark:text-white"
    >
      Dashboard ({user.name ? user.name.split(" ")[0] : "Account"})
    </a>
    <button
      type="button"
      onClick={() => { setMobileOpen(false); logout(); }}
      className="text-xs font-bold text-[#bd554c]"
    >
      Sign out
    </button>
  </div>
) : (
  <button
    type="button"
    onClick={() => { setMobileOpen(false); openAuthModal(); }}
    className="rounded-full bg-[#111318] px-4 py-2 text-white dark:bg-white dark:text-[#111318]"
  >
    Sign in
  </button>
)}</div></div></div>}</header>

    <main id="top"><section className="relative overflow-hidden border-b border-[#e4e5de] dark:border-white/10"><div className="absolute left-[-8rem] top-[-10rem] size-[34rem] rounded-full bg-[#d8ef54]/20 blur-3xl dark:bg-[#d8ef54]/10" /><div className="absolute right-[-12rem] top-[10rem] size-[32rem] rounded-full bg-[#b8b7ff]/30 blur-3xl dark:bg-[#5e5ce6]/20" /><div className="container relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-16 lg:py-24"><div className="max-w-[680px] mx-auto lg:mx-0 flex flex-col items-center lg:items-start text-center lg:text-left"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfe0d8] bg-white/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#5e5ce6] shadow-[0_5px_20px_rgba(17,18,24,0.04)] dark:border-white/10 dark:bg-white/5"><Sparkles size={13} />{preset?.badgeText || "Media, made simple"}</div><h1 className="max-w-[720px] text-4xl sm:text-5xl lg:text-[4.75rem] font-black leading-[0.95] tracking-[-0.07em]">{preset ? (<>{preset.heroHeadline}<br /><span className="relative inline-block text-[#5e5ce6]">{preset.heroHighlight}<span className="absolute -bottom-1 left-1 h-2 w-[92%] rounded-full bg-[#d8ef54] sm:-bottom-2 sm:h-3" /></span><span className="relative z-10">.</span></>) : (<>Download media,<br /><span className="relative inline-block text-[#5e5ce6]">simply<span className="absolute -bottom-1 left-1 h-2 w-[92%] rounded-full bg-[#d8ef54] sm:-bottom-2 sm:h-3" /></span><span className="relative z-10">.</span></>)}</h1><p className="mt-6 max-w-[520px] text-[16px] leading-7 text-[#686b75] dark:text-[#b7bac6] sm:text-[18px] sm:leading-8">{preset?.heroSubheadline || "Paste a public social-media URL and get started in seconds. CBdrop keeps the workflow clear, lightweight, and permission-first."}</p><form onSubmit={handleAnalyze} noValidate className="mt-6 sm:mt-8 w-full max-w-[660px] text-left"><div className={`group relative flex flex-col gap-2 rounded-[22px] border bg-white p-1.5 sm:p-2 shadow-[0_18px_50px_rgba(36,38,51,0.10)] transition focus-within:border-[#5e5ce6] focus-within:ring-4 focus-within:ring-[#5e5ce6]/10 dark:bg-[#1a1c22] ${error ? "border-[#e17b72]" : "border-[#dedfd8] dark:border-white/10"}`}><div className="flex min-h-[54px] sm:min-h-[58px] items-center gap-2 sm:gap-3 px-2.5 sm:pl-4 sm:pr-[160px]"><Link2 size={19} className="shrink-0 text-[#8a8c95]" /><input ref={inputRef} value={url} onChange={(event) => setUrl(event.target.value)} onPaste={(event) => {
  const pastedText = event.clipboardData.getData("text");
  if (pastedText) {
    const clean = pastedText.trim();
    if (clean) {
      event.preventDefault();
      triggerAutoAnalyze(clean);
    }
  }
}} className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#111318] outline-none placeholder:text-[#9b9da5] dark:text-white" placeholder={preset?.inputPlaceholder || "Paste a YouTube, TikTok, or other social URL..."} aria-label="Media URL" type="text" autoCapitalize="none" autoCorrect="off" spellCheck="false" />{url ? (
  <button
    type="button"
    onClick={() => {
      setUrl("");
      setError("");
      if (status === "failed") setStatus("idle");
      inputRef.current?.focus();
    }}
    className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#f0f0ed] px-3 py-1.5 text-xs font-bold text-[#81838a] transition hover:bg-[#e4e5de] hover:text-[#bd554c] active:scale-95 dark:bg-white/10 dark:hover:bg-white/15 dark:hover:text-[#f2b4ad]"
    aria-label="Clear URL"
  >
    <X size={14} />Clear
  </button>
) : (
  <button
    type="button"
    onClick={() => {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (text) {
            const clean = text.trim();
            if (clean) {
              triggerAutoAnalyze(clean);
            }
          }
        })
        .catch(() => toast.info("Paste permission is unavailable"));
    }}
    className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#f0f0ed] px-3 py-1.5 text-xs font-bold text-[#5e5ce6] transition hover:bg-[#e4e5de] hover:text-[#504ed1] active:scale-95 dark:bg-white/10 dark:text-[#d8ef54] dark:hover:bg-white/15"
    aria-label="Paste URL"
  >
    <Clipboard size={14} />Paste
  </button>

)}</div><button type="submit" disabled={status === "analyzing" || status === "processing"} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#5e5ce6] px-6 text-sm font-black text-white shadow-[0_9px_20px_rgba(94,92,230,0.25)] transition hover:bg-[#504ed1] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 sm:absolute sm:bottom-2 sm:right-2 sm:top-2 sm:h-auto sm:w-auto">{status === "analyzing" ? <><Loader2 size={16} className="animate-spin" />Analyzing...</> : "Analyze URL"}<ChevronRight size={16} /></button></div>{error && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#bd554c]"><CircleAlert size={15} />{error}</p>}</form><div className="mt-8 w-full max-w-[660px]">
  <div className="mb-3 flex items-center justify-center gap-2.5 lg:justify-start">
    <div className="h-px flex-1 bg-gradient-to-l from-[#e4e5de] to-transparent dark:from-white/10 lg:hidden" />
    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d8089] dark:text-[#9b9da5]">
      Supported platforms
    </span>
    <div className="h-px flex-1 bg-gradient-to-r from-[#e4e5de] via-[#e4e5de]/50 to-transparent dark:from-white/10 dark:via-white/5" />
  </div>
  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 lg:justify-start">
    {platformMarks.map((platform) => (
      <PlatformPill key={platform.name} {...platform} />
    ))}
  </div>
</div></div><div className="relative mt-4 lg:mt-0 lg:pl-4"><PreviewCard /></div></div><div className="container relative flex flex-wrap items-center justify-center lg:justify-between gap-4 border-t border-[#e4e5de] py-5 text-xs font-bold uppercase tracking-[0.14em] text-[#92949b] dark:border-white/10"><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#5e5ce6]" />Built for the everyday internet</span><span className="hidden sm:block">Fast by default · Clear by design</span><span>CB / 001</span></div></section>

    {/* Hero Ad Banner Slot (Hidden for Pro subscribers) */}
    <AdBanner slot="hero" />

    {(status !== "idle") && <section className="container py-12 sm:py-16" aria-live="polite">{status === "analyzing" && <div className="mx-auto max-w-3xl rounded-[28px] border border-[#dedfd8] bg-white p-6 shadow-[0_18px_50px_rgba(36,38,51,0.07)] sm:p-8 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#5e5ce6]">Live analysis</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">Finding the best handoff.</h2></div><Loader2 className="animate-spin text-[#5e5ce6]" /></div><div className="mt-8 grid gap-3 sm:grid-cols-3">{["Validating URL", "Detecting platform", "Extracting formats"].map((label, index) => <div key={label} className="rounded-2xl border border-[#d8ef54] bg-[#fbfdea] p-4 dark:bg-[#252a1a]"><div className="flex items-center gap-2 text-sm font-bold"><span className="flex size-6 items-center justify-center rounded-full bg-[#d8ef54] text-[#596b0c]"><Check size={13} strokeWidth={3} /></span>{label}</div></div>)}</div></div>}{status === "failed" && (() => {
      const isFacebookIssue =
        url.includes("facebook.com") ||
        url.includes("/stories/") ||
        error.toLowerCase().includes("facebook") ||
        error.toLowerCase().includes("story") ||
        error.toLowerCase().includes("cookies.txt");

      return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <div className="flex items-start gap-4 rounded-[28px] border border-[#edc1bc] bg-[#fff8f7] p-6 text-[#7f3f3a] sm:p-8 dark:border-[#8b4540]/60 dark:bg-[#2b1b1b] dark:text-[#f2b4ad]">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8dcd8]">
              <CircleAlert size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em]">Could not analyze</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.04em]">
                {isFacebookIssue
                  ? "Facebook Story requires viewer session"
                  : error.toLowerCase().includes("age")
                  ? "Age verification required"
                  : "We couldn't process this URL."}
              </h2>
              <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={resetAnalyzer} className="inline-flex items-center gap-2 text-sm font-black underline underline-offset-4">
                  Try another link <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setUrl("https://www.youtube.com/watch?v=aqz-KE-bpKQ"); setError(""); setStatus("idle"); }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e17b72] bg-white px-3.5 py-1.5 text-xs font-bold text-[#bd554c] shadow-sm transition hover:bg-[#fff0ee] dark:bg-white/10 dark:text-white"
                >
                  <Sparkles size={13} />
                  Try sample public video
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}{media && (status === "ready" || status === "processing" || status === "completed") && (
      <div id="results" ref={resultsRef} className="scroll-mt-8">
        {/* Results Ad Banner Slot (Hidden for Pro subscribers) */}
        <AdBanner slot="results" className="mb-6" />
        {hasVideo ? (
        <div className="mx-auto max-w-4xl rounded-[22px] sm:rounded-[28px] border border-[#e5e6df] bg-white p-3.5 sm:p-5 md:p-6 shadow-[0_20px_50px_rgba(20,24,40,0.06)] transition-all dark:border-white/10 dark:bg-[#1a1c22]">
          <div className="grid gap-4 sm:gap-5 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] items-start">
            
            {/* Left Column: Media Thumbnail & Creator Bar */}
            <div className="flex flex-col gap-2.5">
              <div className="relative aspect-video w-full overflow-hidden rounded-[18px] sm:rounded-[20px] bg-[#0d0f14] text-white shadow-md group">
                {media.thumbnailUrl ? (
                  <>
                    <img
                      src={media.thumbnailUrl}
                      alt={media.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (!target.dataset.failedOnce && target.src.includes("maxresdefault")) {
                          target.dataset.failedOnce = "1";
                          target.src = target.src.replace(/maxresdefault\.[a-z0-9]+/i, "hqdefault.jpg");
                          return;
                        }
                        target.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0d0f14]">
                    <FileVideo size={36} className="text-white/30" />
                  </div>
                )}

                {/* Top Overlay Badges */}
                <div className="relative z-10 flex h-full flex-col justify-between p-3 pointer-events-none">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/95 backdrop-blur-md border border-white/15">
                      {media.platform}
                    </span>
                    {media.duration && (
                      <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white/95 backdrop-blur-md border border-white/15">
                        <Clock3 size={11} />
                        {media.duration}
                      </span>
                    )}
                  </div>

                  {/* Bottom Play Button & Selected Quality Pill */}
                  <div className="flex items-end justify-between">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#423ce6] to-[#6c69fd] text-white backdrop-blur-md shadow-[0_6px_16px_rgba(83,79,252,0.45)] transition-transform duration-300 group-hover:scale-110">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </div>
                    {selected && (
                      <span className="rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-black tracking-wide text-[#d2f54a] backdrop-blur-md border border-white/15 shadow-xs">
                        {selected.quality} · {selected.size}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Creator Meta Pill */}
              <div className="flex items-center justify-between rounded-xl border border-[#e8e9e1] bg-[#f9f9f6] px-3.5 py-2 text-xs font-semibold text-[#666872] dark:border-white/10 dark:bg-white/5 dark:text-[#a0a3af]">
                <span className="truncate max-w-[170px] font-bold text-[#111318] dark:text-white">
                  {media.creator}
                </span>
                <span className="shrink-0 font-black text-[#534ffd]">
                  {media.platform}
                </span>
              </div>
            </div>

            {/* Right Column: Title, Metadata, Formats Grid */}
            <div className="flex min-w-0 flex-col justify-between gap-3 sm:gap-3.5">
              <div>
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef0d5] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7b17] dark:bg-[#30371d] dark:text-[#d2f54a]">
                    {media.platform}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#71737d] dark:text-[#9ea1ad]">
                    <CheckCircle2 size={13} className="text-[#6b7b17] dark:text-[#a3b82c]" />
                    Source detected
                  </span>
                </div>

                {/* Video Title */}
                <h2 className="mt-1.5 text-base sm:text-lg lg:text-xl font-black leading-snug tracking-[-0.03em] text-[#111318] dark:text-white line-clamp-2">
                  {media.title}
                </h2>

                {media.ready === false && (
                  <p className="mt-1 text-xs font-bold text-[#534ffd]">
                    Cloudflare Stream is preparing the video. This page will update when ready.
                  </p>
                )}

                <p className="mt-1 text-[11px] sm:text-xs font-medium text-[#7c7f8a] dark:text-[#9ea1ad]">
                  {media.creator} · {media.duration} · public source
                </p>
              </div>

              {/* Format Selection Section */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Category Filter Pills */}
                  {availableCategories.length > 1 ? (
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#f0f0ed] p-1 dark:bg-white/5">
                      {availableCategories.map((cat) => {
                        const isActive = formatCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategoryChange(cat.id)}
                            className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                              isActive
                                ? "bg-white text-[#111318] shadow-xs dark:bg-[#534ffd] dark:text-white"
                                : "text-[#6b6e7b] hover:text-[#111318] dark:text-[#9ea1ad] dark:hover:text-white"
                            }`}
                          >
                            {cat.label} ({cat.count})
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#838590] dark:text-[#9ea1ad]">
                      CHOOSE A FORMAT
                    </p>
                  )}

                  <span className="text-[11px] font-bold text-[#534ffd]">
                    {filteredFormats.length} available
                  </span>
                </div>

                {/* Formats Grid with Max-Height & Custom Scrollbar */}
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 max-h-[220px] sm:max-h-[250px] md:max-h-[280px] overflow-y-auto pr-1 sm:pr-1.5 custom-scrollbar">
                  {filteredFormats.map((format) => {
                    const isSelected = selectedFormat === format.id;
                    const isImage = format.type === "image";
                    const isAudio = format.type === "audio";
                    const isProOnly = isFormatPro(format);

                    return (
                      <button
                        key={format.id}
                        type="button"
                        onClick={() => {
                          if (isProOnly && !isPro) {
                            openUpgradeModal();
                            toast.info(`${format.quality} is a CBdrop Pro format.`, {
                              description: "Upgrade to unlock 4K, 60fps & 100% ad-free downloads.",
                            });
                            return;
                          }
                          handleSelectFormat(format.id);
                        }}
                        className={`group relative flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-150 active:scale-[0.99] ${
                          isSelected
                            ? "border-[#534ffd] bg-[#f2f1ff] ring-2 ring-[#534ffd]/20 shadow-xs dark:border-[#534ffd] dark:bg-[#534ffd]/15"
                            : "border-[#e5e6df] bg-[#fbfbf8] hover:border-[#bfbdfa] hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {/* Format Icon with colored squircle background */}
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
                              isImage
                                ? "bg-[#dff0e6] text-[#2e7d32] dark:bg-[#1f3a29] dark:text-[#81c784]"
                                : isAudio
                                ? "bg-[#fce6df] text-[#c4614f] dark:bg-[#3d2420] dark:text-[#e57373]"
                                : "bg-[#e8e6ff] text-[#534ffd] dark:bg-[#2b2754] dark:text-[#a5a2ff]"
                            }`}
                          >
                            {isImage ? (
                              <ImageIcon size={15} />
                            ) : isAudio ? (
                              <FileAudio size={15} />
                            ) : (
                              <FileVideo size={15} />
                            )}
                          </span>

                          {/* Format Details */}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs sm:text-[13px] font-black text-[#111318] dark:text-white">
                                {format.container.toUpperCase()} · {format.quality}
                              </span>
                              {isProOnly && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#5e5ce6] to-[#8d8bff] px-1.5 py-0.2 text-[9px] font-black text-white shadow-xs">
                                  <Crown size={9} /> PRO
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-black ${
                                  isSelected
                                    ? "bg-[#534ffd] text-white"
                                    : "bg-[#534ffd]/10 text-[#534ffd] dark:bg-white/10 dark:text-[#d2f54a]"
                                }`}
                              >
                                {format.size}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] font-medium text-[#7d808c] dark:text-[#9ea1ad]">
                              {format.note}
                            </span>
                          </span>
                        </span>

                        {/* Radio Check Circle */}
                        <span
                          className={`flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? "border-[#534ffd] bg-[#534ffd] text-white shadow-xs"
                              : "border-[#d0d2ca] bg-transparent text-transparent dark:border-white/20"
                          }`}
                        >
                          <Check size={10} strokeWidth={3.5} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer Bar */}
          <div className="mt-4 sm:mt-5 flex flex-col justify-between gap-3 border-t border-[#ecece7] pt-3.5 sm:pt-4 sm:flex-row sm:items-center dark:border-white/10">
            <div className="flex flex-col gap-1 text-xs text-[#7c7f8a] dark:text-[#9ea1ad]">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="text-[#111318] dark:text-white font-bold text-xs">Selected:</span>
                {selected && (
                  <>
                    <span className="rounded-lg bg-[#f0f0ed] px-2.5 py-0.5 text-xs font-black text-[#111318] dark:bg-white/10 dark:text-white">
                      {selected.container.toUpperCase()} · {selected.quality}
                    </span>
                    <span className="rounded-lg bg-[#534ffd]/10 px-2.5 py-0.5 text-xs font-black text-[#534ffd] dark:bg-white/10 dark:text-white">
                      File size: {selected.size}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Info size={12} className="shrink-0" />
                <span>Only use media you have permission to download.</span>
              </div>
            </div>

            {/* Main Action Download Button */}
            <div className="flex w-full sm:w-auto shrink-0 items-center gap-2.5">
              {isSelectedJobCompleted ? (
                <button
                  onClick={downloadManifest}
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#d2f54a] px-6 text-sm font-black text-[#1e2605] shadow-[0_6px_18px_rgba(210,245,74,0.35)] transition-all hover:bg-[#c4ec3e] hover:shadow-[0_10px_24px_rgba(210,245,74,0.45)] active:scale-[0.98]"
                >
                  <Download size={16} strokeWidth={2.5} />
                  <span>{job?.downloadUrl ? `Download file (${selected?.size ?? ""})` : "Download manifest"}</span>
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={status === "processing"}
                  className="group inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4d48f9] to-[#5a56fd] px-7 text-sm font-black text-white shadow-[0_8px_20px_rgba(83,79,252,0.32)] transition-all hover:shadow-[0_12px_28px_rgba(83,79,252,0.42)] hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                >
                  {status === "processing" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Preparing download {selected?.size ? `(${selected.size})` : ""}...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine size={16} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-y-0.5" />
                      <span>Download {selected ? `${selected.container.toUpperCase()} ${selected.quality} (${selected.size})` : "media"}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Active Download Progress Card */}
          {activeDownload && (
            <div className="mt-3.5 rounded-2xl border border-[#e5e6df] bg-[#fbfbf8] p-3.5 sm:p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      activeDownload.status === "completed"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400"
                        : activeDownload.status === "interrupted"
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400"
                        : activeDownload.status === "resuming"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
                        : "bg-[#5e5ce6]/15 text-[#5e5ce6] dark:bg-[#d8ef54]/20 dark:text-[#d8ef54]"
                    }`}
                  >
                    {activeDownload.status === "completed" ? (
                      <CheckCircle2 size={18} strokeWidth={2.5} />
                    ) : activeDownload.status === "interrupted" ? (
                      <AlertCircle size={18} strokeWidth={2.5} />
                    ) : activeDownload.status === "resuming" ? (
                      <RefreshCw size={18} strokeWidth={2.5} className="animate-spin" />
                    ) : (
                      <ArrowDownToLine size={18} strokeWidth={2.5} className="animate-bounce" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs sm:text-sm font-black text-[#111318] dark:text-white max-w-[180px] sm:max-w-xs md:max-w-md" title={activeDownload.filename}>
                        {activeDownload.filename}
                      </p>
                      <span className="rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-black uppercase text-[#5e5ce6] dark:text-[#d8ef54]">
                        {activeDownload.container} · {activeDownload.quality}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#8a8d98] dark:text-[#9ea1ae]">
                      {activeDownload.status === "completed" && "Download complete · Saved to browser downloads"}
                      {activeDownload.status === "resuming" && "Connection active · Resuming from last byte..."}
                      {activeDownload.status === "downloading" && "Downloading · Fast direct stream"}
                      {activeDownload.status === "preparing" && "Connecting to media stream..."}
                      {activeDownload.status === "interrupted" && "Connection paused or network dropped · Waiting to resume"}
                      {activeDownload.status === "error" && (activeDownload.error || "Download error encountered")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
                      activeDownload.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : activeDownload.status === "interrupted"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse"
                        : activeDownload.status === "resuming"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                        : "bg-[#5e5ce6]/10 text-[#5e5ce6] dark:bg-[#d8ef54]/10 dark:text-[#d8ef54]"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        activeDownload.status === "completed"
                          ? "bg-emerald-500"
                          : activeDownload.status === "interrupted"
                          ? "bg-amber-500"
                          : activeDownload.status === "resuming"
                          ? "bg-blue-500 animate-ping"
                          : "bg-[#5e5ce6] dark:bg-[#d8ef54] animate-pulse"
                      }`}
                    />
                    <span>
                      {activeDownload.status === "completed"
                        ? "Completed"
                        : activeDownload.status === "interrupted"
                        ? "Paused"
                        : activeDownload.status === "resuming"
                        ? "Resuming..."
                        : activeDownload.status === "preparing"
                        ? "Connecting..."
                        : "Downloading"}
                    </span>
                  </span>
                  <button
                    onClick={() => setActiveDownload(null)}
                    className="rounded-full p-1 text-[#8a8d98] hover:bg-[#f0f0ed] dark:text-[#9ea1ae] dark:hover:bg-white/10 transition"
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#f0f0ed] dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activeDownload.status === "completed"
                        ? "bg-emerald-500"
                        : activeDownload.status === "interrupted"
                        ? "bg-amber-500"
                        : activeDownload.status === "resuming"
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse"
                        : "bg-gradient-to-r from-[#5e5ce6] to-[#d8ef54]"
                    }`}
                    style={{
                      width:
                        activeDownload.totalBytes > 0
                          ? `${Math.min(
                              100,
                              Math.max(
                                activeDownload.downloadedBytes > 0 ? 3 : 0,
                                Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)
                              )
                            )}%`
                          : activeDownload.status === "completed"
                          ? "100%"
                          : "40%",
                    }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-[#686b75] dark:text-[#b7bac6]">
                  <div>
                    {activeDownload.downloadedBytes > 0 ? (
                      <span>
                        <strong className="text-[#111318] dark:text-white">
                          {formatBytes(activeDownload.downloadedBytes)}
                        </strong>
                        {activeDownload.totalBytes > 0 && ` / ${formatBytes(activeDownload.totalBytes)}`}
                        {activeDownload.totalBytes > 0 && (
                          <span className="ml-1 text-[#8a8d98] dark:text-[#9ea1ae]">
                            ({Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100)}%)
                          </span>
                        )}
                        {activeDownload.totalBytes > activeDownload.downloadedBytes && (
                          <span className="ml-1.5 font-bold text-[#5e5ce6] dark:text-[#d8ef54]">
                            · {formatBytes(activeDownload.totalBytes - activeDownload.downloadedBytes)} left
                          </span>
                        )}
                      </span>
                    ) : activeDownload.totalBytes > 0 ? (
                      <span>
                        Total size:{" "}
                        <strong className="text-[#111318] dark:text-white">
                          {formatBytes(activeDownload.totalBytes)}
                        </strong>
                      </span>
                    ) : (
                      <span>Determining file size...</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {activeDownload.speed > 0 && (
                      <span className="font-bold text-[#5e5ce6] dark:text-[#d8ef54]">
                        {formatSpeed(activeDownload.speed)}
                      </span>
                    )}
                    {activeDownload.eta > 0 && activeDownload.status === "downloading" && (
                      <span className="text-[#8a8d98] dark:text-[#9ea1ae]">
                        {formatETA(activeDownload.eta)}
                      </span>
                    )}
                    {activeDownload.status === "interrupted" && (
                      <button
                        onClick={() => triggerFileDownload(activeDownload.downloadUrl, activeDownload.filename)}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition"
                      >
                        <RefreshCw size={11} />
                        <span>Resume</span>
                      </button>
                    )}
                    {activeDownload.status === "completed" && (
                      <button
                        onClick={() => triggerFileDownload(activeDownload.downloadUrl, activeDownload.filename)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 transition"
                      >
                        <Download size={11} />
                        <span>Save again</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {isSelectedJobCompleted && !activeDownload && (
            <div className="mt-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-[#f5f8df] p-3 sm:p-3.5 text-[#525f0e] dark:bg-[#252c16] dark:text-[#d2f54a] border border-[#e1ebad] dark:border-white/10">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#60700f] dark:text-[#d2f54a]" />
                <div>
                  <p className="text-xs sm:text-sm font-black">Your {selected?.type === "image" ? "image" : "video"} is ready to download.</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-semibold opacity-90">
                    Format: <span className="font-bold">{selected?.container.toUpperCase()} ({selected?.quality})</span> · File size: <span className="font-bold">{selected?.size}</span>
                  </p>
                </div>
              </div>
              {job?.downloadUrl && (
                <button
                  onClick={downloadManifest}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#525f0e] px-4 text-xs font-black text-white hover:bg-[#434e0a] dark:bg-[#d2f54a] dark:text-[#1e2605] dark:hover:bg-[#c4ec3e] shadow-xs transition"
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Save file</span>
                </button>
              )}
            </div>
          )}
        </div>

      ) : isSingleImage ? (
        <div className="mx-auto max-w-xl rounded-[30px] border border-[#dedfd8] bg-white p-4 shadow-[0_24px_70px_rgba(36,38,51,0.10)] sm:p-6 dark:border-white/10 dark:bg-[#1a1c22]">
          <div className="mb-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eef0d5] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6b7b17] dark:bg-[#30371d] dark:text-[#d8ef54]">
                {media.platform}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#898b93]">
                <CheckCircle2 size={13} className="text-[#6b7b17]" />
                Image post
              </span>
            </div>
            <h2 className="text-xl font-black tracking-[-0.04em] text-[#111318] dark:text-white">
              {media.title || "Image"}
            </h2>
            <p className="text-xs font-semibold text-[#85878e] dark:text-[#b0b3bf]">
              @{media.creator.replace(/^@/, "")} · Best quality original
            </p>
          </div>

          <ImageCard
            format={imageFormats[0]}
            onDownload={() => handleDownloadSlide(imageFormats[0], 0)}
            isDownloading={downloadingSlideId === imageFormats[0]?.id}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl rounded-[30px] border border-[#dedfd8] bg-white p-4 shadow-[0_24px_70px_rgba(36,38,51,0.10)] sm:p-6 lg:p-7 dark:border-white/10 dark:bg-[#1a1c22]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="relative flex aspect-square w-14 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#111318] shadow-md border border-[#dedfd8] dark:border-white/10">
                {imageFormats[0]?.downloadUrl ? (
                  <img
                    src={`/api/thumbnail-proxy?url=${encodeURIComponent(imageFormats[0].downloadUrl)}`}
                    alt="Slides preview"
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <div className="relative z-10 text-center">
                  <p className="text-base sm:text-lg font-black text-white leading-none">
                    {imageFormats.length}
                  </p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-[#d8ef54]">
                    PHOTOS
                  </p>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef0d5] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#6b7b17] dark:bg-[#30371d] dark:text-[#d8ef54]">
                    {media.platform}
                  </span>
                  <span className="truncate text-xs font-bold text-[#111318] dark:text-white">
                    @{media.creator.replace(/^@/, "")}
                  </span>
                </div>

                <h2 className="mt-1 text-base sm:text-lg font-black tracking-[-0.03em] text-[#111318] dark:text-white line-clamp-1">
                  {media.title || "Photo Slideshow"}
                </h2>

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#85878e] dark:text-[#b0b3bf]">
                  <span>{imageFormats.length} photos</span>
                  <span>·</span>
                  <span className="text-[#5e5ce6] dark:text-[#d8ef54]">Best quality original</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:justify-end shrink-0 gap-2">
              {audioFormats.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadSlide(audioFormats[0], 0)}
                  disabled={downloadingSlideId === audioFormats[0].id || downloadAllProgress !== null}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#dedfd8] bg-white px-4 text-xs font-black text-[#111318] shadow-sm transition hover:border-[#5e5ce6] hover:text-[#5e5ce6] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-[#d8ef54]"
                >
                  {downloadingSlideId === audioFormats[0].id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Audio...</span>
                    </>
                  ) : (
                    <>
                      <FileAudio size={14} />
                      <span>Music ({audioFormats[0].container.toUpperCase()})</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!isPro) {
                    openUpgradeModal();
                    toast.info("1-Click Carousel ZIP Download requires CBdrop Pro.", {
                      description: "Upgrade to Pro to download all photos in 1 click, or download each photo individually for free.",
                    });
                    return;
                  }
                  handleDownloadAll();
                }}
                disabled={downloadAllProgress !== null || isZipping}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111318] px-5 text-xs font-black text-white shadow-md transition hover:bg-[#5e5ce6] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-[#111318] dark:hover:bg-[#d8ef54]"
              >
                {isZipping ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Preparing ZIP ({imageFormats.length} Photos)...</span>
                  </>
                ) : downloadAllProgress !== null ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Downloading ({downloadAllProgress.current}/{downloadAllProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} strokeWidth={2.5} />
                    <span>Download All ({imageFormats.length} Photos · ZIP)</span>
                    {!isPro && (
                      <span className="rounded bg-gradient-to-r from-[#5e5ce6] to-[#8d8bff] px-1.5 py-0.2 text-[9px] font-black uppercase text-white shadow-xs">
                        PRO
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="my-5 border-t border-[#dedfd8] dark:border-white/10" />

          {/* Responsive Photo Grid (Initial 4, expands on Show More) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
            {displayedImages.map((format, index) => (
              <ImageCard
                key={format.id}
                format={format}
                index={index}
                total={imageFormats.length}
                onDownload={() => handleDownloadSlide(format, index)}
                onPreview={() => setPreviewIndex(index)}
                isDownloading={downloadingSlideId === format.id}
                disabled={downloadAllProgress !== null || isZipping}
              />
            ))}
          </div>

          {/* Show More / Show All (Initial 4, one click shows all, with Show Less option) */}
          {imageFormats.length > 4 && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              {remainingImages > 0 ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount(imageFormats.length)}
                  className="group inline-flex h-11 items-center justify-center gap-2.5 rounded-full border-2 border-[#5e5ce6] bg-white px-7 text-xs font-black text-[#5e5ce6] shadow-[0_4px_16px_rgba(94,92,230,0.15)] transition hover:bg-[#5e5ce6] hover:text-white active:scale-[0.98] dark:bg-[#1a1c22] dark:border-[#5e5ce6] dark:text-[#d8ef54] dark:hover:bg-[#5e5ce6] dark:hover:text-white"
                >
                  <Plus size={15} strokeWidth={3} className="transition-transform duration-200 group-hover:rotate-90" />
                  <span>Show More · {remainingImages} remaining</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#dedfd8] bg-[#fbfbf8] px-5 py-2 text-xs font-bold text-[#686b75] shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-[#b8bbc6]">
                    <Check size={14} className="text-[#5e5ce6] dark:text-[#d8ef54]" strokeWidth={3} />
                    <span>All {imageFormats.length} images displayed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(4)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#dedfd8] bg-white px-4 py-2 text-xs font-bold text-[#686b75] shadow-sm transition hover:border-[#5e5ce6] hover:text-[#5e5ce6] active:scale-[0.98] dark:border-white/10 dark:bg-white/5 dark:text-[#b8bbc6] dark:hover:text-white"
                  >
                    <span>Show Less</span>
                  </button>
                </div>
              )}

              <p className="text-[11px] font-semibold text-[#85878e] dark:text-[#a0a3af]">
                Showing {displayedImages.length} of {imageFormats.length} photos
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    )}</section>}

    {/* Lightbox Preview Modal */}
    {previewIndex !== null && imageFormats[previewIndex] && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setPreviewIndex(null)}
      >
        <div
          className="relative flex max-h-[92vh] max-w-4xl flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Controls */}
          <div className="mb-3 flex w-full items-center justify-between px-2 text-white">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur-md">
                Photo {previewIndex + 1} of {imageFormats.length}
              </span>
              <span className="text-xs font-bold text-[#d8ef54]">
                {imageFormats[previewIndex].quality} · {imageFormats[previewIndex].container.toUpperCase()}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/35 active:scale-95"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Image View */}
          <div className="relative flex max-h-[72vh] items-center justify-center overflow-hidden rounded-2xl bg-black/40 shadow-2xl border border-white/10">
            <img
              src={`/api/thumbnail-proxy?url=${encodeURIComponent(imageFormats[previewIndex].downloadUrl || "")}`}
              alt={`Photo ${previewIndex + 1}`}
              className="max-h-[72vh] max-w-full object-contain"
            />

            {/* Navigation Arrows */}
            {imageFormats.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : imageFormats.length - 1))}
                  className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 hover:scale-105 active:scale-95 border border-white/15"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} />
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewIndex((prev) => (prev !== null && prev < imageFormats.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 hover:scale-105 active:scale-95 border border-white/15"
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          {/* Bottom Action */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleDownloadSlide(imageFormats[previewIndex], previewIndex)}
              disabled={downloadingSlideId === imageFormats[previewIndex].id}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#5e5ce6] px-7 text-xs font-black text-white shadow-lg transition hover:bg-[#504ed1] active:scale-95 disabled:opacity-70"
            >
              {downloadingSlideId === imageFormats[previewIndex].id ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download size={16} strokeWidth={2.5} />
                  <span>Download Photo {previewIndex + 1} ({imageFormats[previewIndex].quality})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    <section id="platforms" className="border-y border-[#e4e5de] bg-white/50 dark:border-white/10 dark:bg-white/[0.02]"><div className="container grid gap-10 py-14 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:items-center"><div className="text-center lg:text-left"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#5e5ce6]">Supported, thoughtfully</p><h2 className="mt-3 mx-auto lg:mx-0 max-w-[350px] text-3xl font-black leading-tight tracking-[-0.07em] sm:text-4xl">One clean workflow. Your favorite platforms.</h2></div><div className="mx-auto grid max-w-[680px] grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-none">{platformMarks.map((platform) => <div key={platform.name} className={`group flex items-center gap-3.5 rounded-2xl border border-[#e5e6df] bg-white p-4 shadow-[0_5px_18px_rgba(17,18,24,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#1a1c22] ${platform.hoverBorder}`}><span className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${platform.badgeBg}`}><PlatformIcon name={platform.name} size={18} /></span><div><span className="text-sm font-black text-[#111318] dark:text-white">{platform.name}</span><p className="text-[11px] font-medium text-[#81838a] dark:text-[#9b9da5]">Video & media</p></div></div>)}</div></div></section>
    <section id="how-it-works" className="container py-20 sm:py-28"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"><div className="flex flex-col items-center text-center lg:items-start lg:text-left"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#5e5ce6]">How it works</p><h2 className="mt-4 max-w-[420px] text-4xl font-black leading-[0.98] tracking-[-0.08em] sm:text-5xl">Less hunting.<br /><span className="text-[#5e5ce6]">More doing.</span></h2><p className="mt-6 max-w-[360px] text-base leading-7 text-[#73757e] dark:text-[#b7bac6]">CBdrop turns a familiar three-step task into a calmer, more focused experience.</p><a href="#top" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#5e5ce6] hover:underline">Back to analyzer <ArrowUpRight size={15} /></a></div><div className="mx-auto grid max-w-[680px] w-full gap-4 lg:max-w-none">{steps.map(([number, title, description]) => <div key={number} className="group grid gap-5 rounded-[24px] border border-[#e3e4dd] bg-white p-6 transition hover:-translate-y-1 hover:border-[#bbb9f2] hover:shadow-[0_18px_45px_rgba(36,38,51,0.08)] sm:grid-cols-[72px_1fr] sm:items-start sm:p-7 dark:border-white/10 dark:bg-[#1a1c22]"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#f0efff] text-sm font-black text-[#5e5ce6] dark:bg-[#292741]">{number}</div><div><h3 className="text-xl font-black tracking-[-0.05em]">{title}</h3><p className="mt-2 max-w-[520px] text-sm leading-6 text-[#777982] dark:text-[#b7bac6]">{description}</p></div><div className="hidden justify-end sm:flex"><ArrowUpRight size={18} className="text-[#a4a5ae] transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#5e5ce6]" /></div></div>)}</div></div></section>
    <section id="faq" className="border-t border-[#e4e5de] dark:border-white/10"><div className="container grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"><div className="text-center lg:text-left"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#5e5ce6]">Good to know</p><h2 className="mt-3 text-3xl font-black tracking-[-0.07em]">A few clear answers.</h2></div><div className="mx-auto grid max-w-[680px] w-full gap-7 lg:max-w-none">{(preset?.faqs || [["Do I need an account?", "No. Guests can analyze public social URLs and use the core workflow. Sign in later when you want history and saved preferences."], ["What content can I use?", "Only content you have permission to use. CBdrop is designed for permitted workflows and does not bypass DRM, authentication, or access controls."], ["Is this the final downloader?", "This MVP proves the experience and the adapter boundary. The extractor resolves each post into available formats before download."]]).map(([question, answer]) => <div key={question} className="border-b border-[#e4e5de] pb-6 dark:border-white/10"><div className="flex items-center gap-3 text-base font-black"><Plus size={17} className="text-[#5e5ce6]" />{question}</div><p className="mt-3 max-w-[600px] pl-7 text-sm leading-6 text-[#777982] dark:text-[#b7bac6]">{answer}</p></div>)}</div></div></section>

    {/* Related Free Media Tools (SEO & Discovery Grid) */}
    <section id="tools" className="border-t border-[#e4e5de] bg-[#f9f9f7] py-16 sm:py-20 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="container">
        <div className="mb-10 text-center lg:text-left">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5e5ce6]">Free Creator Tools</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.07em] sm:text-4xl">More tools you might need</h2>
          <p className="mt-2 max-w-[600px] text-sm text-[#777982] dark:text-[#b7bac6]">Dedicated high-speed downloaders for every social platform, quality level, and media format.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_SEO_TOOLS.map((tool) => (
            <a
              key={tool.slug}
              href={tool.path}
              className={`group flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                preset?.slug === tool.slug
                  ? "border-[#5e5ce6] bg-[#f2f1ff] dark:border-[#5e5ce6]/60 dark:bg-[#5e5ce6]/10"
                  : "border-[#e5e6df] bg-white hover:border-[#5e5ce6]/40 dark:border-white/10 dark:bg-[#1a1c22]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#1e2029] text-white shadow-xs dark:bg-[#292741]">
                    <PlatformIcon name={tool.primaryPlatform} size={18} />
                  </span>
                  <span className="text-[11px] font-bold text-[#81838a] group-hover:text-[#5e5ce6] transition-colors flex items-center gap-1">
                    Open Tool <ArrowUpRight size={13} />
                  </span>
                </div>
                <h3 className="mt-4 text-base font-black tracking-tight text-[#111318] group-hover:text-[#5e5ce6] transition-colors dark:text-white">
                  {tool.badgeText}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#777982] dark:text-[#9ea1ad]">
                  {tool.description}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-[#f0f0ed] pt-3 text-[11px] font-bold text-[#5e5ce6] dark:border-white/5">
                <Sparkles size={11} />
                <span>100% Free · No Software</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section></main>
    <footer className="border-t border-[#e4e5de] dark:border-white/10">
      <div className="container flex flex-col justify-between gap-6 py-8 text-sm sm:flex-row sm:items-center">
        <a href="#top" className="flex items-center gap-2 group" aria-label="CBdrop home">
          <img
            src="/logo.png"
            alt="CBdrop"
            className="h-7 w-auto object-contain dark:hidden transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          <img
            src="/logo-dark.png"
            alt="CBdrop"
            className="h-7 w-auto object-contain hidden dark:block transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        </a>
        <p className="text-xs font-medium text-[#8b8d95]">Make media tools simple, fast, and accessible.</p>
        <div className="flex items-center gap-4 text-xs font-bold text-[#73757e]">
          <span>© 2026 CBdrop</span>
          <a className="hover:text-[#534ffd]" href="#faq">Privacy-first</a>
        </div>
      </div>
    </footer>
  </div>;
}
