import type { InsertUser, User } from "../drizzle/schema";
import { store, type StoredUser } from "./store";

function toSchemaUser(u: StoredUser): User {
  return {
    id: u.id,
    openId: u.openId,
    name: u.name,
    email: u.email,
    loginMethod: "local",
    role: u.role,
    plan: u.plan,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    lastSignedIn: new Date(u.lastSignedIn),
  };
}

export async function upsertUser(user: Partial<InsertUser>): Promise<User | null> {
  if (user.email) {
    const existing = store.getUserByEmail(user.email);
    if (existing) return toSchemaUser(existing);
    const created = store.createUser({
      name: user.name || "Creator",
      email: user.email,
      plan: user.plan || "free",
    });
    return toSchemaUser(created);
  }
  const defaultUser = store.getUserById(1);
  return defaultUser ? toSchemaUser(defaultUser) : null;
}

export async function getUser(id: number): Promise<User | null> {
  const u = store.getUserById(id);
  return u ? toSchemaUser(u) : null;
}

export { store };
