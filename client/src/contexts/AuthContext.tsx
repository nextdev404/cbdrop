import React, { createContext, useContext, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface UserProfile {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  plan: "free" | "pro";
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (creds: { email: string; password?: string }) => Promise<void>;
  register: (data: { name: string; email: string; password?: string }) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user as any);
      utils.account.overview.invalidate();
      utils.account.history.invalidate();
      if (data.token) {
        localStorage.setItem("cbdrop_session_token", data.token);
      }
      setIsAuthModalOpen(false);
      toast.success(`Welcome back, ${data.user.name || "Creator"}! 👋`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to sign in");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user as any);
      utils.account.overview.invalidate();
      utils.account.history.invalidate();
      if (data.token) {
        localStorage.setItem("cbdrop_session_token", data.token);
      }
      setIsAuthModalOpen(false);
      toast.success(`Account created successfully! Welcome, ${data.user.name}! 🎉`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create account");
    },
  });

  const demoLoginMutation = trpc.auth.demoLogin.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user as any);
      utils.account.overview.invalidate();
      utils.account.history.invalidate();
      if (data.token) {
        localStorage.setItem("cbdrop_session_token", data.token);
      }
      setIsAuthModalOpen(false);
      toast.success("Logged in as Demo Creator! 👋");
    },
    onError: (err) => {
      toast.error(err.message || "Demo login failed");
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      utils.account.overview.invalidate();
      utils.account.history.invalidate();
      localStorage.removeItem("cbdrop_session_token");
      toast.info("Signed out of your account");
    },
  });

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const login = async (creds: { email: string; password?: string }) => {
    await loginMutation.mutateAsync({ email: creds.email, password: creds.password || "password123" });
  };

  const register = async (data: { name: string; email: string; password?: string }) => {
    await registerMutation.mutateAsync({
      name: data.name,
      email: data.email,
      password: data.password || "password123",
    });
  };

  const demoLogin = async () => {
    await demoLoginMutation.mutateAsync();
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const refresh = async () => {
    await meQuery.refetch();
  };

  return (
    <AuthContext.Provider
      value={{
        user: (meQuery.data as UserProfile | null) ?? null,
        loading: meQuery.isLoading || loginMutation.isPending || registerMutation.isPending || demoLoginMutation.isPending,
        isAuthenticated: Boolean(meQuery.data),
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        demoLogin,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
