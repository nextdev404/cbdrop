import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface StoredUser {
  id: number;
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: "user" | "admin";
  plan: "free" | "pro";
  proExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
}

export interface StoredSession {
  token: string;
  userId: number;
  expiresAt: string;
  createdAt: string;
}

export interface StoredDownloadHistory {
  id: number;
  userId: number;
  mediaId: string;
  sourceUrl: string;
  platform: string;
  title: string;
  creator: string | null;
  quality: string;
  container: string;
  status: string;
  filename: string | null;
  createdAt: string;
}

export interface StoredPayment {
  id: string;
  userId: number;
  amount: number;
  currency: string;
  plan: "pro";
  interval: "monthly" | "yearly";
  method: string; // e.g. "card", "paypal", "crypto"
  status: "completed" | "pending";
  createdAt: string;
}

interface StoreData {
  users: StoredUser[];
  sessions: StoredSession[];
  history: StoredDownloadHistory[];
  payments: StoredPayment[];
  nextUserId: number;
  nextHistoryId: number;
}

const DATA_DIR = path.resolve(process.cwd(), "server", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
  } catch {
    return false;
  }
}

class PersistentStore {
  private data: StoreData = {
    users: [],
    sessions: [],
    history: [],
    payments: [],
    nextUserId: 1,
    nextHistoryId: 1,
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, "utf-8");
        this.data = JSON.parse(raw);
      } else {
        // Seed default demo creator user for instant testing
        const demoCreds = hashPassword("demo123");
        this.data.users.push({
          id: 1,
          openId: "demo_creator_1",
          name: "Demo Creator",
          email: "demo@cbdrop.com",
          passwordHash: demoCreds.hash,
          salt: demoCreds.salt,
          role: "user",
          plan: "free",
          proExpiresAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSignedIn: new Date().toISOString(),
        });
        this.data.nextUserId = 2;
        this.save();
      }
    } catch (err) {
      console.warn("Failed to initialize store file, using in-memory store:", err);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist store data:", err);
    }
  }

  // Users
  createUser(params: { name: string; email: string; password?: string; plan?: "free" | "pro" }): StoredUser {
    const existing = this.getUserByEmail(params.email);
    if (existing) {
      throw new Error("An account with this email already exists. Please log in.");
    }

    const { hash, salt } = hashPassword(params.password || "password123");
    const user: StoredUser = {
      id: this.data.nextUserId++,
      openId: `user_${crypto.randomBytes(8).toString("hex")}`,
      name: params.name.trim() || params.email.split("@")[0],
      email: params.email.toLowerCase().trim(),
      passwordHash: hash,
      salt: salt,
      role: "user",
      plan: params.plan || "free",
      proExpiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    };

    this.data.users.push(user);
    this.save();
    return user;
  }

  authenticate(email: string, password?: string): StoredUser | null {
    const user = this.getUserByEmail(email);
    if (!user) return null;

    if (password && !verifyPassword(password, user.passwordHash, user.salt)) {
      return null;
    }

    user.lastSignedIn = new Date().toISOString();
    this.save();
    return user;
  }

  getUserById(id: number): StoredUser | null {
    return this.data.users.find((u) => u.id === id) || null;
  }

  getUserByEmail(email: string): StoredUser | null {
    const normalized = email.toLowerCase().trim();
    return this.data.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  setUserPlan(userId: number, plan: "free" | "pro", durationDays: number = 30): StoredUser {
    const user = this.getUserById(userId);
    if (!user) throw new Error("User not found");

    user.plan = plan;
    if (plan === "pro") {
      const expires = new Date();
      expires.setDate(expires.getDate() + durationDays);
      user.proExpiresAt = expires.toISOString();
    } else {
      user.proExpiresAt = null;
    }
    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  // Sessions
  createSession(userId: number): StoredSession {
    // Clean up expired sessions
    const now = new Date().toISOString();
    this.data.sessions = this.data.sessions.filter((s) => s.expiresAt > now);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day session

    const session: StoredSession = {
      token: crypto.randomBytes(32).toString("hex"),
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.data.sessions.push(session);
    this.save();
    return session;
  }

  getUserFromSession(token: string): StoredUser | null {
    if (!token) return null;
    const now = new Date().toISOString();
    const session = this.data.sessions.find((s) => s.token === token && s.expiresAt > now);
    if (!session) return null;
    return this.getUserById(session.userId);
  }

  destroySession(token: string): boolean {
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    if (this.data.sessions.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Download History
  recordDownload(item: Omit<StoredDownloadHistory, "id" | "createdAt">): StoredDownloadHistory {
    const record: StoredDownloadHistory = {
      id: this.data.nextHistoryId++,
      ...item,
      createdAt: new Date().toISOString(),
    };
    this.data.history.unshift(record);
    // Keep max 200 history items
    if (this.data.history.length > 200) {
      this.data.history = this.data.history.slice(0, 200);
    }
    this.save();
    return record;
  }

  getUserHistory(userId: number): StoredDownloadHistory[] {
    return this.data.history.filter((h) => h.userId === userId);
  }

  // Payments
  recordPayment(params: {
    userId: number;
    amount: number;
    interval: "monthly" | "yearly";
    method: string;
  }): StoredPayment {
    const payment: StoredPayment = {
      id: `pay_${crypto.randomBytes(8).toString("hex")}`,
      userId: params.userId,
      amount: params.amount,
      currency: "USD",
      plan: "pro",
      interval: params.interval,
      method: params.method,
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    this.data.payments.push(payment);
    // Upgrade the user
    this.setUserPlan(params.userId, "pro", params.interval === "yearly" ? 365 : 30);
    this.save();
    return payment;
  }

  getRecentDownloadsCount(userId: number): number {
    return this.data.history.filter((h) => h.userId === userId).length;
  }
}

export const store = new PersistentStore();
