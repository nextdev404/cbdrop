import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { store } from "./store";
import { getUser } from "./db";

describe("Authentication & Authorization Security", () => {
  beforeEach(() => {
    // Ensure clean test user
    const existing = store.getUserByEmail("authtest@cbdrop.com");
    if (!existing) {
      store.createUser({
        name: "Security Tester",
        email: "authtest@cbdrop.com",
        password: "securePassword123!",
        plan: "free",
      });
    }
  });

  it("authenticates valid credentials and creates a session", async () => {
    const caller = appRouter.createCaller({
      user: null,
      sessionToken: null,
      req: {} as any,
      res: { setHeader: () => {} } as any,
    });

    const res = await caller.auth.login({
      email: "authtest@cbdrop.com",
      password: "securePassword123!",
    });

    expect(res.user.email).toBe("authtest@cbdrop.com");
    expect(res.token).toBeDefined();
    expect(res.token.length).toBeGreaterThan(10);
  });

  it("blocks brute-force login attempts after repeated failures", async () => {
    const caller = appRouter.createCaller({
      user: null,
      sessionToken: null,
      req: {} as any,
      res: { setHeader: () => {} } as any,
    });

    const targetEmail = "bruteforce@cbdrop.com";
    // Attempt 5 incorrect passwords
    for (let i = 0; i < 5; i++) {
      try {
        await caller.auth.login({
          email: targetEmail,
          password: "wrongPassword" + i,
        });
      } catch (err: any) {
        expect(err.code).toBe("UNAUTHORIZED");
      }
    }

    // 6th attempt should be locked out with TOO_MANY_REQUESTS
    await expect(
      caller.auth.login({
        email: targetEmail,
        password: "wrongPassword6",
      })
    ).rejects.toThrow(/temporarily locked for security/);
  });

  it("protects download history from unauthenticated guests", async () => {
    const guestCaller = appRouter.createCaller({
      user: null,
      sessionToken: null,
      req: {} as any,
      res: {} as any,
    });

    const history = await guestCaller.account.history();
    expect(history).toEqual([]);
  });

  it("allows authenticated user to view their own download history", async () => {
    const testUser = store.getUserByEmail("authtest@cbdrop.com")!;
    store.recordDownload({
      userId: testUser.id,
      mediaId: "test-auth-media",
      sourceUrl: "https://example.com/test",
      platform: "Test",
      title: "Test Download",
      creator: "Tester",
      quality: "1080p",
      container: "mp4",
      filename: "test.mp4",
      status: "completed",
    });

    const dbUser = await getUser(testUser.id);
    const userCaller = appRouter.createCaller({
      user: dbUser,
      sessionToken: "dummy-token",
      req: {} as any,
      res: {} as any,
    });

    const history = await userCaller.account.history();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].userId).toBe(testUser.id);
  });

  it("blocks unauthenticated users from updating account preferences", async () => {
    const guestCaller = appRouter.createCaller({
      user: null,
      sessionToken: null,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      guestCaller.account.preferences.update({
        defaultFormat: "mp4",
        preferredQuality: "720p",
        theme: "dark",
      })
    ).rejects.toThrow(/You must be signed in/);
  });
});
