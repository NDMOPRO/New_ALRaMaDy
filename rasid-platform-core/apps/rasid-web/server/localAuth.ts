import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { getUserByUserId, createUser, updateUserLastSignIn } from "./localDb";

const JWT_SECRET = process.env.JWT_SECRET || "rasid-local-secret-key-2024-ultra-secure";
const secret = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "rasid_session";

export interface LocalUser {
  id: number; userId: string; displayName: string; email: string | null;
  mobile: string | null; role: string; department: string | null;
  avatar: string | null; status: string; permissions: string[];
  createdAt: string; lastSignedIn: string;
}

export async function hashPassword(p: string) { return bcrypt.hash(p, 12); }
export async function verifyPassword(p: string, h: string) { return bcrypt.compare(p, h); }

export async function createToken(user: { id: number; userId: string; role: string }) {
  return new SignJWT({ sub: String(user.id), userId: user.userId, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").setIssuedAt().sign(secret);
}

export async function verifyToken(token: string) {
  try { const { payload } = await jwtVerify(token, secret); return payload as any; }
  catch { return null; }
}

export async function loginUser(userId: string, password: string) {
  const u = await getUserByUserId(userId);
  if (!u) return null;
  if (!(await verifyPassword(password, u.passwordHash as string))) return null;
  await updateUserLastSignIn(userId);
  const user: LocalUser = {
    id: u.id as number, userId: u.userId as string, displayName: u.displayName as string,
    email: u.email as string|null, mobile: u.mobile as string|null, role: u.role as string,
    department: u.department as string|null, avatar: u.avatar as string|null,
    status: u.status as string, permissions: JSON.parse((u.permissions as string)||'[]'),
    createdAt: u.createdAt as string, lastSignedIn: new Date().toISOString(),
  };
  const token = await createToken({ id: user.id, userId: user.userId, role: user.role });
  return { user, token };
}

export async function registerUser(data: { userId: string; password: string; displayName: string; email?: string; mobile?: string; department?: string }) {
  const existing = await getUserByUserId(data.userId);
  if (existing) return { error: "اسم المستخدم مسجل مسبقاً" };
  const hash = await hashPassword(data.password);
  const u = await createUser({ userId: data.userId, passwordHash: hash, displayName: data.displayName, email: data.email, mobile: data.mobile, department: data.department, role: 'user', permissions: ['view_analytics','create_reports'] });
  if (!u) return { error: "فشل في إنشاء الحساب" };
  const user: LocalUser = { id: u.id as number, userId: u.userId as string, displayName: u.displayName as string, email: u.email as string|null, mobile: u.mobile as string|null, role: u.role as string, department: u.department as string|null, avatar: null, status: 'active', permissions: JSON.parse((u.permissions as string)||'[]'), createdAt: u.createdAt as string, lastSignedIn: new Date().toISOString() };
  const token = await createToken({ id: user.id, userId: user.userId, role: user.role });
  return { user, token };
}

export async function getUserFromRequest(req: Request): Promise<LocalUser | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const u = await getUserByUserId(payload.userId);
  if (!u) return null;
  return { id: u.id as number, userId: u.userId as string, displayName: u.displayName as string, email: u.email as string|null, mobile: u.mobile as string|null, role: u.role as string, department: u.department as string|null, avatar: u.avatar as string|null, status: u.status as string, permissions: JSON.parse((u.permissions as string)||'[]'), createdAt: u.createdAt as string, lastSignedIn: u.lastSignedIn as string };
}

export function setAuthCookie(res: Response, token: string, req: Request) {
  const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: isSecure, sameSite: isSecure ? 'none' : 'lax', path: '/', maxAge: 30*24*60*60*1000 });
}

export function clearAuthCookie(res: Response, req: Request) {
  const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isSecure, sameSite: isSecure ? 'none' : 'lax', path: '/' });
}
