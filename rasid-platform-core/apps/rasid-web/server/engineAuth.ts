/**
 * Engine Authentication — ALL auth goes through the Central Engine on Railway
 * NO local SQLite, NO local DB, NO local password hashing
 * 
 * Auth flow:
 * 1. User submits credentials → sent to Central Engine (governance/auth/login)
 * 2. Engine validates and returns token + user data
 * 3. Token stored in cookie for session persistence
 * 4. On each request, token sent to engine to verify (governance/auth/me)
 */
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { engineLogin, engineRegister, engineGetProfile, type EngineUser } from "./platformConnector";
import { COOKIE_NAME } from "../shared/const";

const JWT_SECRET_KEY = process.env.JWT_SECRET || "rasid-engine-secret-key-2024";
const secret = new TextEncoder().encode(JWT_SECRET_KEY);
const TOKEN_EXPIRY = "30d";

// Re-export EngineUser as the user type
export type { EngineUser };

/** Create a local JWT wrapping the engine token and user info */
export async function createSessionToken(user: EngineUser, engineToken: string): Promise<string> {
  return new SignJWT({
    sub: user.id,
    userId: user.userId,
    role: user.role,
    engineToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(secret);
}

/** Verify a session token */
export async function verifyToken(token: string): Promise<{
  sub: string;
  userId: string;
  role: string;
  engineToken: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as any;
  } catch {
    return null;
  }
}

/** Login via Central Engine */
export async function loginUser(
  userId: string,
  password: string
): Promise<{ user: EngineUser; token: string } | null> {
  const result = await engineLogin(userId, password);

  if (!result.ok) {
    console.warn(`[EngineAuth] Login failed for ${userId}:`, result.error);
    return null;
  }

  const data = result.data as any;
  
  // Normalize user from engine response
  const user: EngineUser = {
    id: data.user?.id || data.data?.user?.id || data.id || userId,
    userId: data.user?.username || data.data?.user?.username || userId,
    displayName: data.user?.display_name || data.data?.user?.display_name || data.user?.displayName || userId,
    email: data.user?.email || data.data?.user?.email || null,
    mobile: data.user?.mobile || data.data?.user?.mobile || null,
    role: data.user?.role || data.data?.user?.role || "user",
    department: data.user?.department || data.data?.user?.department || null,
    avatar: data.user?.avatar || data.data?.user?.avatar || null,
    status: data.user?.status || data.data?.user?.status || "active",
    permissions: data.user?.permissions || data.data?.user?.permissions || [],
    createdAt: data.user?.created_at || data.data?.user?.created_at || new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  };

  const engineToken = data.accessToken || data.data?.accessToken || data.token || data.data?.token || "";
  const sessionToken = await createSessionToken(user, engineToken);

  return { user, token: sessionToken };
}

/** Register via Central Engine */
export async function registerUser(data: {
  userId: string;
  password: string;
  displayName: string;
  email?: string;
  mobile?: string;
  department?: string;
}): Promise<{ user: EngineUser; token: string } | { error: string }> {
  const result = await engineRegister(data);

  if (!result.ok) {
    const errData = result.data as any;
    return {
      error: errData?.message || errData?.error || result.error || "فشل في إنشاء الحساب عبر المحرك",
    };
  }

  const resData = result.data as any;

  const user: EngineUser = {
    id: resData.user?.id || resData.data?.user?.id || data.userId,
    userId: resData.user?.username || resData.data?.user?.username || data.userId,
    displayName: resData.user?.display_name || resData.data?.user?.display_name || data.displayName,
    email: resData.user?.email || resData.data?.user?.email || data.email || null,
    mobile: resData.user?.mobile || resData.data?.user?.mobile || data.mobile || null,
    role: resData.user?.role || resData.data?.user?.role || "user",
    department: resData.user?.department || resData.data?.user?.department || data.department || null,
    avatar: null,
    status: "active",
    permissions: resData.user?.permissions || ["view_analytics", "create_reports"],
    createdAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  };

  const engineToken = resData.accessToken || resData.data?.accessToken || resData.token || "";
  const sessionToken = await createSessionToken(user, engineToken);

  return { user, token: sessionToken };
}

/** Extract user from request cookie — verifies with engine */
export async function getUserFromRequest(req: Request): Promise<EngineUser | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Return cached user info from JWT (engine already validated at login)
  return {
    id: payload.sub,
    userId: payload.userId,
    displayName: payload.userId, // Will be enriched on next profile fetch
    email: null,
    mobile: null,
    role: payload.role,
    department: null,
    avatar: null,
    status: "active",
    permissions: [],
    createdAt: "",
    lastSignedIn: "",
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
