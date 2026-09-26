import React, { useEffect, useRef } from "react";
import { ShieldCheck, Sparkles, ExternalLink, Zap } from "lucide-react";
import { usePro } from "@/contexts/ProContext";
import { adConfig } from "@/config/ads";

interface AdBannerProps {
  slot: "hero" | "results" | "footer";
  className?: string;
}

export function AdBanner({ slot, className = "" }: AdBannerProps) {
  const { isPro, openUpgradeModal } = usePro();
  const adContainerRef = useRef<HTMLDivElement>(null);

  // If user is a Pro subscriber, completely suppress all ads
  if (isPro) {
    return null;
  }

  // If third-party network ads (Monetag / Adsterra) are enabled:
  if (adConfig.networkAdsEnabled) {
    return (
      <div className={`w-full max-w-[728px] mx-auto my-6 px-2 ${className}`}>
        <div className="flex items-center justify-between pb-1 text-[10px] font-bold uppercase tracking-wider text-[#91939d] dark:text-[#6a6d78]">
          <span>Advertisement</span>
          <button
            type="button"
            onClick={openUpgradeModal}
            className="flex items-center gap-1 text-[#5e5ce6] hover:underline"
          >
            <Zap size={10} fill="currentColor" /> Remove Ads with Pro
          </button>
        </div>
        <div
          ref={adContainerRef}
          className="min-h-[90px] w-full overflow-hidden rounded-2xl border border-[#dedfd8] bg-white p-2 text-center dark:border-white/10 dark:bg-[#1a1c22]"
        >
          {/* Third-party ad script renders here */}
          <div className="flex h-[90px] items-center justify-center text-xs text-[#8a8c96]">
            {adConfig.provider === "monetag"
              ? `Monetag Ad Slot (Zone: ${adConfig.monetagZoneId || "Active"})`
              : `Adsterra Ad Slot`}
          </div>
        </div>
      </div>
    );
  }

  // Default: Sleek, high-converting Affiliate & Sponsor Card (Zero spam, pure revenue)
  return (
    <aside
      aria-label="Sponsored recommendation"
      className={`w-full max-w-[700px] mx-auto my-6 px-3 ${className}`}
    >
      <div className="overflow-hidden rounded-2xl border border-[#dfe0d8] bg-gradient-to-r from-white via-[#fbfbf8] to-[#f4f3ff] p-3.5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:from-[#171922] dark:via-[#1a1c24] dark:to-[#201f35]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left Info */}
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#5e5ce6]/10 text-[#5e5ce6] dark:bg-[#d8ef54]/15 dark:text-[#d8ef54]">
              <ShieldCheck size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#73757f] dark:text-[#9ea1ad]">
                  Sponsored
                </span>
                <span className="rounded-full bg-[#d8ef54] px-2 py-0.2 text-[9px] font-black uppercase text-[#425008]">
                  {adConfig.affiliateBanner.badge}
                </span>
              </div>
              <h4 className="mt-0.5 text-xs sm:text-[13px] font-black text-[#111318] dark:text-white truncate">
                {adConfig.affiliateBanner.title}
              </h4>
              <p className="text-[11px] text-[#6e717c] dark:text-[#9ea1ad] line-clamp-1">
                {adConfig.affiliateBanner.description}
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={openUpgradeModal}
              className="text-[11px] font-bold text-[#5e5ce6] hover:underline px-2 py-1"
            >
              Hide with Pro
            </button>
            <a
              href={adConfig.affiliateBanner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111318] px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition hover:bg-[#5e5ce6] dark:bg-white dark:text-[#111318] dark:hover:bg-[#d8ef54]"
            >
              <span>{adConfig.affiliateBanner.ctaText}</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
