import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { store } from "../store";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  sessionToken: string | null;
};

function extractSessionToken(req: CreateExpressContextOptions["req"]): string | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Check x-session-token header
  const customHeader = req.headers["x-session-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }

  // 3. Check Cookie header
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(";");
    for (const c of cookies) {
      const [key, val] = c.trim().split("=");
      if (key === "cbdrop_session" && val) {
        return decodeURIComponent(val);
      }
    }
  }

  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const token = extractSessionToken(opts.req);

  if (token) {
    try {
      const stored = store.getUserFromSession(token);
      if (stored) {
        user = {
          id: stored.id,
          openId: stored.openId,
          name: stored.name,
          email: stored.email,
          loginMethod: "local",
          role: stored.role,
          plan: stored.plan,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          createdAt: new Date(stored.createdAt),
          updatedAt: new Date(stored.updatedAt),
          lastSignedIn: new Date(stored.lastSignedIn),
        };
      }
    } catch (error) {
      console.warn("Failed to resolve user session:", error);
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    sessionToken: token,
  };
}
