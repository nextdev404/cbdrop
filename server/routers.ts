import { existsSync, promises as fs } from "node:fs";
import { resolve } from "node:path";
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { TrpcContext } from "./_core/context";
import { store } from "./store";
import {
  resolveMedia,
  refreshMedia,
  prepareDownload,
  prepareZipDownload,
  refreshDownload,
  providerStatus,
} from "./services/media";
import {
  getPaymentGatewayConfig,
  processPayment,
  ACTIVE_PROMO_CODES,
} from "./services/payment";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Brute-force rate limiter
interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}
const authAttempts = new Map<string, AttemptRecord>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const rec = authAttempts.get(key);
  if (rec && rec.blockedUntil && now < rec.blockedUntil) {
    const mins = Math.ceil((rec.blockedUntil - now) / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many failed attempts. Account temporarily locked for security. Please try again in ${mins} minute(s).`,
    });
  }
}

function recordFailedAttempt(key: string, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const rec = authAttempts.get(key);
  if (!rec || now - rec.firstAttempt > windowMs) {
    authAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }
  rec.count++;
  if (rec.count >= maxAttempts) {
    rec.blockedUntil = now + windowMs;
  }
}

function clearRateLimit(key: string) {
  authAttempts.delete(key);
}

// Protected Procedure: Requires authenticated user
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Pro Procedure: Requires Pro subscription or Admin
export const proProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.plan !== "pro" && ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires an active CBdrop Pro subscription.",
    });
  }
  return next({ ctx });
});

// Admin Procedure: Requires Admin role
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin privileges are required for this action.",
    });
  }
  return next({ ctx });
});

const mediaRouter = router({
  analyze: publicProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await resolveMedia(input.url);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to analyze URL",
        });
      }
    }),

  refresh: publicProcedure
    .input(z.object({ mediaId: z.string() }))
    .mutation(async ({ input }) => {
      return refreshMedia(input.mediaId);
    }),

  createJob: publicProcedure
    .input(
      z.object({
        mediaId: z.string(),
        formatId: z.string(),
        sourceUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const job = await prepareDownload(input.sourceUrl, input.mediaId, input.formatId);
        if (ctx.user?.id) {
          store.recordDownload({
            userId: ctx.user.id,
            mediaId: input.mediaId,
            sourceUrl: input.sourceUrl,
            platform: "Social Media",
            title: job.filename || "Video Media",
            creator: null,
            quality: input.formatId,
            container: (job.format && typeof job.format === "object" && "container" in job.format ? job.format.container : job.container) || "mp4",
            status: "completed",
            filename: job.filename,
          });
        }
        return job;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to prepare download",
        });
      }
    }),

  createZipJob: publicProcedure
    .input(
      z.object({
        mediaId: z.string(),
        sourceUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const job = await prepareZipDownload(input.sourceUrl, input.mediaId);
        if (ctx.user?.id) {
          store.recordDownload({
            userId: ctx.user.id,
            mediaId: input.mediaId,
            sourceUrl: input.sourceUrl,
            platform: "Carousel",
            title: job.filename || "Images Archive (ZIP)",
            creator: null,
            quality: "ZIP",
            container: "zip",
            status: "completed",
            filename: job.filename,
          });
        }
        return job;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to prepare ZIP download",
        });
      }
    }),

  refreshJob: publicProcedure
    .input(
      z.object({
        jobId: z.string(),
        formatId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return refreshDownload(input.jobId, input.formatId);
    }),

  status: publicProcedure.query(() => {
    return providerStatus();
  }),

  getCookiesStatus: publicProcedure.query(async () => {
    const rootCookies = resolve(process.cwd(), "cookies.txt");
    const exists = existsSync(rootCookies);
    if (!exists) return { hasCookies: false, hasFacebookCookies: false };
    try {
      const content = await fs.readFile(rootCookies, "utf-8");
      const hasFb = content.includes(".facebook.com") || content.includes("c_user") || content.includes("xs");
      return { hasCookies: true, hasFacebookCookies: hasFb };
    } catch {
      return { hasCookies: false, hasFacebookCookies: false };
    }
  }),

  saveCookies: publicProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      let finalContent = input.content.trim();
      if (!finalContent.includes("\t") && finalContent.includes("=")) {
        const pairs = finalContent.split(";").map((p) => p.trim()).filter(Boolean);
        const lines = [
          "# Netscape HTTP Cookie File",
          "# Saved via CBdrop Facebook Helper",
        ];
        for (const pair of pairs) {
          const eqIdx = pair.indexOf("=");
          if (eqIdx > 0) {
            const name = pair.slice(0, eqIdx).trim();
            const value = pair.slice(eqIdx + 1).trim();
            lines.push(`.facebook.com\tTRUE\t/\tTRUE\t2147483647\t${name}\t${value}`);
          }
        }
        finalContent = lines.join("\n") + "\n";
      } else if (!finalContent.startsWith("# Netscape")) {
        finalContent = "# Netscape HTTP Cookie File\n" + finalContent;
      }
      const rootCookies = resolve(process.cwd(), "cookies.txt");
      await fs.writeFile(rootCookies, finalContent, "utf-8");
      return { success: true };
    }),

  clearCookies: publicProcedure.mutation(async () => {
    const rootCookies = resolve(process.cwd(), "cookies.txt");
    if (existsSync(rootCookies)) {
      await fs.unlink(rootCookies);
    }
    return { success: true };
  }),
});

const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const stored = store.createUser({
          name: input.name,
          email: input.email,
          password: input.password,
          plan: "free",
        });
        const session = store.createSession(stored.id);
        if (ctx.res && typeof ctx.res.setHeader === "function") {
          ctx.res.setHeader(
            "Set-Cookie",
            `cbdrop_session=${encodeURIComponent(session.token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
          );
        }
        return {
          user: {
            id: stored.id,
            openId: stored.openId,
            name: stored.name,
            email: stored.email,
            role: stored.role,
            plan: stored.plan,
          },
          token: session.token,
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to register account",
        });
      }
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emailLower = input.email.trim().toLowerCase();
      checkRateLimit(emailLower);
      const stored = store.authenticate(emailLower, input.password);
      if (!stored) {
        recordFailedAttempt(emailLower);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect email or password. Try demo@cbdrop.com / demo123",
        });
      }
      clearRateLimit(emailLower);
      const session = store.createSession(stored.id);
      if (ctx.res && typeof ctx.res.setHeader === "function") {
        ctx.res.setHeader(
          "Set-Cookie",
          `cbdrop_session=${encodeURIComponent(session.token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
        );
      }
      return {
        user: {
          id: stored.id,
          openId: stored.openId,
          name: stored.name,
          email: stored.email,
          role: stored.role,
          plan: stored.plan,
        },
        token: session.token,
      };
    }),

  demoLogin: publicProcedure.mutation(async ({ ctx }) => {
    let demoUser = store.getUserByEmail("demo@cbdrop.com");
    if (!demoUser) {
      demoUser = store.createUser({
        name: "Demo Creator",
        email: "demo@cbdrop.com",
        password: "demo123",
        plan: "free",
      });
    }
    const session = store.createSession(demoUser.id);
    if (ctx.res && typeof ctx.res.setHeader === "function") {
      ctx.res.setHeader(
        "Set-Cookie",
        `cbdrop_session=${encodeURIComponent(session.token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
      );
    }
    return {
      user: {
        id: demoUser.id,
        openId: demoUser.openId,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        plan: demoUser.plan,
      },
      token: session.token,
    };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) {
      store.destroySession(ctx.sessionToken);
    }
    if (ctx.res && typeof ctx.res.setHeader === "function") {
      ctx.res.setHeader("Set-Cookie", `cbdrop_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
    }
    return { success: true };
  }),

  getPaymentConfig: publicProcedure.query(() => {
    return getPaymentGatewayConfig();
  }),

  validatePromoCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      const clean = input.code.trim().toUpperCase();
      const promo = ACTIVE_PROMO_CODES[clean];
      if (!promo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired promo code.",
        });
      }
      return {
        valid: true,
        code: clean,
        discountPercent: promo.discountPercent,
        description: promo.description,
      };
    }),

  upgradePlan: publicProcedure
    .input(
      z.object({
        interval: z.enum(["monthly", "yearly"]),
        method: z.enum(["card", "paypal", "crypto"]).default("card"),
        cardNumber: z.string().optional(),
        cardExpiry: z.string().optional(),
        cardCvc: z.string().optional(),
        cardName: z.string().optional(),
        promoCode: z.string().optional(),
        cryptoTxid: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let targetUserId = ctx.user?.id;
      if (!targetUserId) {
        let demoUser = store.getUserByEmail("demo@cbdrop.com");
        if (!demoUser) {
          demoUser = store.createUser({
            name: "Demo Creator",
            email: "demo@cbdrop.com",
            password: "demo123",
            plan: "free",
          });
        }
        targetUserId = demoUser.id;
        const session = store.createSession(targetUserId);
        if (ctx.res && typeof ctx.res.setHeader === "function") {
          ctx.res.setHeader(
            "Set-Cookie",
            `cbdrop_session=${encodeURIComponent(session.token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
          );
        }
      }

      try {
        const paymentResult = await processPayment({
          userId: targetUserId,
          interval: input.interval,
          method: input.method,
          cardNumber: input.cardNumber,
          cardExpiry: input.cardExpiry,
          cardCvc: input.cardCvc,
          cardName: input.cardName,
          promoCode: input.promoCode,
          cryptoTxid: input.cryptoTxid,
        });

        const updated = store.getUserById(targetUserId);
        return {
          success: true,
          user: updated,
          payment: paymentResult.payment,
          receipt: paymentResult.receipt,
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Payment processing failed.",
        });
      }
    }),
});

const accountRouter = router({
  overview: publicProcedure.query(({ ctx }) => {
    const user = ctx.user || {
      id: 0,
      name: "Guest Creator",
      email: "guest@cbdrop.local",
      plan: "free" as const,
      role: "user" as const,
    };
    const count = user.id ? store.getRecentDownloadsCount(user.id) : 0;
    return {
      user,
      usage: {
        analyses: count,
        analysisLimit: user.plan === "pro" ? 1000 : 5,
        downloads: count,
        downloadLimit: user.plan === "pro" ? 1000 : 3,
      },
      preferences: {
        defaultFormat: "mp4",
        preferredQuality: "720p",
        theme: "system" as const,
      },
      plans: [
        {
          id: "free",
          name: "Starter",
          price: 0,
          interval: "forever",
          description: "Essential social media downloads for occasional use.",
          features: [
            "5 analyses per month",
            "3 downloads per month",
            "Standard download speed",
            "Public post support",
          ],
        },
        {
          id: "pro",
          name: "Pro Creator",
          price: 4.99,
          interval: "month",
          description: "Unlimited momentum for creators and power users.",
          features: [
            "1,000 analyses per month",
            "1,000 downloads per month",
            "Ultra HD 4K & 60fps downloads",
            "100% Ad-Free experience",
            "1-Click Carousel ZIP downloads",
            "High-speed CDN proxy",
            "Priority queue processing",
          ],
        },
      ],
    };
  }),

  history: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      return [];
    }
    return store.getUserHistory(ctx.user.id);
  }),

  preferences: router({
    update: protectedProcedure
      .input(
        z.object({
          defaultFormat: z.enum(["mp4", "mp3"]),
          preferredQuality: z.enum(["720p", "480p", "audio"]),
          theme: z.enum(["light", "dark", "system"]),
        })
      )
      .mutation(({ input }) => {
        return { success: true, preferences: input };
      }),
  }),
});

const billingRouter = router({
  status: publicProcedure.query(() => {
    return {
      configured: true,
      message: "Direct in-app card & instant activation ready (no domain required).",
    };
  }),

  startUpgrade: publicProcedure
    .input(
      z.object({
        planId: z.string(),
        interval: z.enum(["monthly", "yearly"]).optional(),
        method: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const targetUserId = ctx.user?.id || 1;
      const interval = input.interval || "monthly";
      const amount = interval === "yearly" ? 29 : 4.99;
      const payment = store.recordPayment({
        userId: targetUserId,
        amount,
        interval,
        method: input.method || "card",
      });
      return {
        success: true,
        message: `Plan upgraded to Pro successfully!`,
        payment,
      };
    }),
});

export const appRouter = router({
  auth: authRouter,
  media: mediaRouter,
  account: accountRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
