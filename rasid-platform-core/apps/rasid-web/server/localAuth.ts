/**
 * Local Authentication — fully independent, no external OAuth
 * Uses bcryptjs for password hashing and jose for JWT tokens
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { getUserByUserId, createUser, updateUserLastSignIn } from "./localDb";
import { COOKIE_NAME } from "../shared/const";

const JWT_SECRET_KEY = process.env.JWT_SECRET || "rasid-local-secret-key-2024-ultra-secure";
const secret = new TextEncoder().encode(JWT_SECRET_KEY);
const TOKEN_EXPIRY = "30d";

export interface LocalUser {
  id: number;
  userId: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  department: string | null;
  avatar: string | null;
  status: string;
  permissions: string[];
  createdAt: string;
  lastSignedIn: string;
}

/** Hash a password */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Verify a password against its hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Create a JWT token for a user */
export async function createToken(user: { id: number; userId: string; role: string }): Promise<string> {
  return new SignJWT({ sub: String(user.id), userId: user.userId, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(secret);
}

/** Verify a JWT token and return the payload */
export async function verifyToken(token: string): Promise<{ sub: string; userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as any;
  } catch {
    return null;
  }
}

/** Login a user — returns token or null */
export async function loginUser(userId: string, password: string): Promise<{ user: LocalUser; token: string } | null> {
  const dbUser = await getUserByUserId(userId);
  if (!dbUser) return null;

  const valid = await verifyPassword(password, dbUser.passwordHash as string);
  if (!valid) return null;

  await updateUserLastSignIn(userId);

  const user: LocalUser = {
    id: dbUser.id as number,
    userId: dbUser.userId as string,
    displayName: dbUser.displayName as string,
    email: dbUser.email as string | null,
    mobile: dbUser.mobile as string | null,
    role: dbUser.role as string,
    department: dbUser.department as string | null,
    avatar: dbUser.avatar as string | null,
    status: dbUser.status as string,
    permissions: JSON.parse((dbUser.permissions as string) || "[]"),
    createdAt: dbUser.createdAt as string,
    lastSignedIn: new Date().toISOString(),
  };

  const token = await createToken({ id: user.id, userId: user.userId, role: user.role });
  return { user, token };
}

/** Register a new user */
export async function registerUser(data: {
  userId: string;
  password: string;
  displayName: string;
  email?: string;
  mobile?: string;
  department?: string;
}): Promise<{ user: LocalUser; token: string } | { error: string }> {
  const existing = await getUserByUserId(data.userId);
  if (existing) {
    return { error: "اسم المستخدم مسجل مسبقاً" };
  }

  const passwordHash = await hashPassword(data.password);
  const dbUser = await createUser({
    userId: data.userId,
    passwordHash,
    displayName: data.displayName,
    email: data.email,
    mobile: data.mobile,
    department: data.department,
    role: "user",
    permissions: ["view_analytics", "create_reports"],
  });

  if (!dbUser) {
    return { error: "فشل في إنشاء الحساب" };
  }

  const user: LocalUser = {
    id: dbUser.id as number,
    userId: dbUser.userId as string,
    displayName: dbUser.displayName as string,
    email: dbUser.email as string | null,
    mobile: dbUser.mobile as string | null,
    role: dbUser.role as string,
    department: dbUser.department as string | null,
    avatar: dbUser.avatar as string | null,
    status: dbUser.status as string,
    permissions: JSON.parse((dbUser.permissions as string) || "[]"),
    createdAt: dbUser.createdAt as string,
    lastSignedIn: new Date().toISOString(),
  };

  const token = await createToken({ id: user.id, userId: user.userId, role: user.role });
  return { user, token };
}

/** Extract user from request cookie */
export async function getUserFromRequest(req: Request): Promise<LocalUser | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const dbUser = await getUserByUserId(payload.userId);
  if (!dbUser) return null;

  return {
    id: dbUser.id as number,
    userId: dbUser.userId as string,
    displayName: dbUser.displayName as string,
    email: dbUser.email as string | null,
    mobile: dbUser.mobile as string | null,
    role: dbUser.role as string,
    department: dbUser.department as string | null,
    avatar: dbUser.avatar as string | null,
    status: dbUser.status as string,
    permissions: JSON.parse((dbUser.permissions as string) || "[]"),
    createdAt: dbUser.createdAt as string,
    lastSignedIn: dbUser.lastSignedIn as string,
  };
}

/** Set auth cookie on response */
export function setAuthCookie(res: Response, token: string, req: Request) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

/** Clear auth cookie */
export function clearAuthCookie(res: Response, req: Request) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
  });
}
