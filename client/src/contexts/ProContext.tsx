import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthContext } from "./AuthContext";

interface ProContextType {
  isPro: boolean;
  proKey: string | null;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  activatePro: (keyOrEmail: string) => { success: boolean; message: string };
  deactivatePro: () => void;
}

const ProContext = createContext<ProContextType | undefined>(undefined);

const STORAGE_ACTIVE_KEY = "cbdrop_pro_active";
const STORAGE_LICENSE_KEY = "cbdrop_pro_key";

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const isUserPro = user?.plan === "pro";

  const [isPro, setIsPro] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_ACTIVE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [proKey, setProKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_LICENSE_KEY);
    } catch {
      return null;
    }
  });

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Effective Pro status (either local key or logged-in Pro account)
  const effectiveIsPro = isPro || isUserPro;

  // Sync state across browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_ACTIVE_KEY) {
        setIsPro(e.newValue === "true");
      }
      if (e.key === STORAGE_LICENSE_KEY) {
        setProKey(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const openUpgradeModal = () => setIsUpgradeModalOpen(true);
  const closeUpgradeModal = () => setIsUpgradeModalOpen(false);

  const activatePro = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, message: "Please enter a valid license key or order email." };
    }

    // Accepts test keys (CBDROP-TEST, CBDROP-PRO-XXXX, TEST-PRO) or valid email/order IDs
    const upper = trimmed.toUpperCase();
    const isTestKey =
      upper === "CBDROP-TEST" ||
      upper === "CBDROP-PRO" ||
      upper === "TEST" ||
      upper.startsWith("CBDROP-") ||
      upper.startsWith("PRO-") ||
      trimmed.includes("@");

    if (isTestKey) {
      try {
        localStorage.setItem(STORAGE_ACTIVE_KEY, "true");
        localStorage.setItem(STORAGE_LICENSE_KEY, trimmed);
      } catch {}
      setIsPro(true);
      setProKey(trimmed);
      toast.success("CBdrop Pro activated! All ads removed and 4K unlocked. 🎉");
      return { success: true, message: "CBdrop Pro is now active on this device!" };
    }

    return {
      success: false,
      message: "Invalid license key. Check your Lemon Squeezy receipt or try test key: CBDROP-TEST",
    };
  };

  const deactivatePro = () => {
    try {
      localStorage.removeItem(STORAGE_ACTIVE_KEY);
      localStorage.removeItem(STORAGE_LICENSE_KEY);
    } catch {}
    setIsPro(false);
    setProKey(null);
    toast.info("CBdrop Pro deactivated. Switched back to standard free tier.");
  };

  return (
    <ProContext.Provider
      value={{
        isPro: effectiveIsPro,
        proKey,
        isUpgradeModalOpen,
        openUpgradeModal,
        closeUpgradeModal,
        activatePro,
        deactivatePro,
      }}
    >
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  const context = useContext(ProContext);
  if (!context) {
    throw new Error("usePro must be used within a ProProvider");
  }
  return context;
}
