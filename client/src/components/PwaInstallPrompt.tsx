import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!deferredPrompt || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-5 duration-300 md:bottom-6 md:right-6 md:left-auto">
      <div className="flex items-center gap-3 rounded-2xl border border-[#5e5ce6]/30 bg-[#111318]/95 p-3.5 text-white shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#181a24]/95">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md">
          <img src="/icons/icon-192.png" alt="CBdrop" className="size-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black tracking-tight text-white">{t.pwa.installTitle}</p>
          <p className="line-clamp-1 text-[11px] text-[#a5a7b4]">{t.pwa.installDesc}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1 rounded-xl bg-[#5e5ce6] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#6c6ae9] active:scale-95"
          >
            <Download size={13} />
            <span>{t.pwa.installBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label={t.pwa.dismiss}
            className="rounded-lg p-1 text-[#838592] hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
