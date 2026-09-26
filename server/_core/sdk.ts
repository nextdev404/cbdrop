import type { Request } from "express";
import type { User } from "../../drizzle/schema";

export const sdk = {
  async authenticateRequest(_req: Request): Promise<User | null> {
    return null;
  },
  async exchangeCodeForToken(_code: string, _state: string): Promise<{ accessToken: string }> {
    return { accessToken: "mock-access-token" };
  },
  async getUserInfo(_accessToken: string): Promise<{ openId: string; name?: string; email?: string; loginMethod?: string; platform?: string }> {
    return { openId: "guest_user", name: "Guest Creator" };
  },
  async createSessionToken(_openId: string, _options?: { name?: string; expiresInMs?: number }): Promise<string> {
    return "session_token_stub";
  },
};
