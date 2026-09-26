import React, { useState } from "react";
import { Check, Crown, Sparkles, X, Zap, Shield, ArrowUpRight, Copy } from "lucide-react";
import { usePro } from "@/contexts/ProContext";
import { adConfig } from "@/config/ads";
import { toast } from "sonner";
import { PaymentModal } from "./PaymentModal";

export function UpgradeModal() {
  const { isPro, proKey, isUpgradeModalOpen, closeUpgradeModal, activatePro, deactivatePro } = usePro();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [licenseInput, setLicenseInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  if (!isUpgradeModalOpen) return null;

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = activatePro(licenseInput);
    if (result.success) {
      setLicenseInput("");
      setShowKeyInput(false);
      closeUpgradeModal();
    } else {
      toast.error(result.message);
    }
  };

  const handleCheckout = () => {
    setIsPaymentOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#e4e5de] bg-[#fdfdfc] text-[#111318] shadow-2xl dark:border-white/10 dark:bg-[#16181f] dark:text-[#f7f7f2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent Circles */}
        <div className="absolute -left-12 -top-12 size-48 rounded-full bg-[#5e5ce6]/25 blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 size-48 rounded-full bg-[#d8ef54]/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/5 text-[#6c6e79] transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#5e5ce6] to-[#8d8bff] text-white shadow-lg shadow-[#5e5ce6]/30">
              <Crown size={22} />
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#5e5ce6]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#5e5ce6] dark:bg-[#5e5ce6]/20 dark:text-[#a5a3ff]">
                <Sparkles size={11} />
                Creator & Power User
              </div>
              <h3 className="text-2xl font-black tracking-[-0.04em] mt-0.5">
                CBdrop <span className="text-[#5e5ce6]">Pro</span>
              </h3>
            </div>
          </div>

          {isPro ? (
            /* Current Pro Member Status */
            <div className="mt-6 rounded-2xl border border-[#d8ef54]/50 bg-[#fbfdea] p-5 dark:border-[#d8ef54]/30 dark:bg-[#222718]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#455209] dark:text-[#d8ef54]">
                <Zap size={16} fill="currentColor" />
                <span>You have an active CBdrop Pro subscription!</span>
              </div>
              <p className="mt-1 text-xs text-[#5f6834] dark:text-[#b4bda0]">
                All ads are disabled, and 4K downloads are unlocked on this device.
                {proKey && <span className="block mt-1 font-mono text-[11px] opacity-80">Key: {proKey}</span>}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={closeUpgradeModal}
                  className="rounded-xl bg-[#5e5ce6] px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-[#504ed1]"
                >
                  Continue Browsing
                </button>
                <button
                  onClick={deactivatePro}
                  className="rounded-xl border border-[#dedfd8] bg-white px-3 py-2 text-xs font-bold text-[#777983] transition hover:bg-[#f2f2ef] dark:border-white/10 dark:bg-white/10 dark:text-white"
                >
                  Switch Back to Free
                </button>
              </div>
            </div>
          ) : (
            /* Free User Upgrade Flow */
            <>
              {/* Features List */}
              <div className="mt-5 space-y-2.5">
                {[
                  "Ultra HD 4K, 2K & 60fps downloads (unrestricted quality)",
                  "100% Ad-Free experience (zero banners or delays)",
                  "1-Click Batch Carousel Download (save all slides in 1 ZIP)",
                  "Studio 320kbps MP3 / WAV audio extraction",
                  "Turbo Cloud download priority (bypass all queues)",
                ].map((perk) => (
                  <div key={perk} className="flex items-center gap-2.5 text-xs font-semibold text-[#444651] dark:text-[#cfd2de]">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#d8ef54] text-[#4d5b13]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              {/* Billing Cycle Toggle */}
              <div className="mt-6 flex items-center justify-center">
                <div className="inline-flex rounded-full border border-[#dedfd8] bg-[#f0f0ed] p-1 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      billingCycle === "monthly"
                        ? "bg-white text-[#111318] shadow-sm dark:bg-[#5e5ce6] dark:text-white"
                        : "text-[#71737e] hover:text-[#111318] dark:text-[#a0a3af] dark:hover:text-white"
                    }`}
                  >
                    Monthly ($4.99/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`relative rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      billingCycle === "yearly"
                        ? "bg-white text-[#111318] shadow-sm dark:bg-[#5e5ce6] dark:text-white"
                        : "text-[#71737e] hover:text-[#111318] dark:text-[#a0a3af] dark:hover:text-white"
                    }`}
                  >
                    Annual ($29/yr)
                    <span className="ml-1 rounded-full bg-[#d8ef54] px-1.5 py-0.2 text-[9px] font-black uppercase text-[#475708]">
                      Save 51%
                    </span>
                  </button>
                </div>
              </div>

              {/* Price Callout */}
              <div className="mt-4 text-center">
                <div className="text-3xl font-black tracking-[-0.04em]">
                  {billingCycle === "yearly" ? "$2.41" : "$4.99"}
                  <span className="text-sm font-semibold text-[#7c7f8a] dark:text-[#9ea1ad]"> / month</span>
                </div>
                <p className="text-[11px] text-[#8a8d97] dark:text-[#9ea1ad]">
                  {billingCycle === "yearly" ? "Billed annually at $29/year. Cancel anytime." : "Billed monthly. Cancel anytime."}
                </p>
              </div>

              {/* Main CTA */}
              <button
                type="button"
                onClick={handleCheckout}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5e5ce6] text-sm font-black text-white shadow-[0_8px_22px_rgba(94,92,230,0.35)] transition-all hover:bg-[#504ed1] active:scale-[0.98]"
              >
                <span>Upgrade to CBdrop Pro</span>
                <ArrowUpRight size={16} />
              </button>

              {/* Have Key Section / Test Key */}
              <div className="mt-4 border-t border-[#dedfd8] pt-4 dark:border-white/10">
                {!showKeyInput ? (
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(true)}
                      className="font-bold text-[#5e5ce6] hover:underline"
                    >
                      Already have a License Key or Email?
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePro("CBDROP-TEST")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7d808c] hover:text-[#5e5ce6] dark:text-[#9ea1ad]"
                      title="Click to test Pro for free"
                    >
                      <Sparkles size={11} /> Test with 1-Click
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleActivate} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={licenseInput}
                        onChange={(e) => setLicenseInput(e.target.value)}
                        placeholder="Enter key (e.g. CBDROP-TEST or receipt email)..."
                        className="min-w-0 flex-1 rounded-xl border border-[#dedfd8] bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[#111318] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#5e5ce6] dark:bg-white dark:text-[#111318]"
                      >
                        Activate
                      </button>
                    </div>
                    <p className="text-[10px] text-[#8a8d97] dark:text-[#9ea1ad]">
                      Enter receipt email or test key <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10 font-bold">CBDROP-TEST</code>
                    </p>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          closeUpgradeModal();
        }}
        interval={billingCycle}
      />
    </div>
  );
}
