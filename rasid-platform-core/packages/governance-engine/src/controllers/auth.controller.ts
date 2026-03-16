/**
 * متحكم المصادقة
 * محول من Express controller إلى دوال مستقلة
 */
import { createLogger } from '../utils/logger';

const logger = createLogger('auth-controller');

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
  error?: string;
}

export async function login(req: AuthRequest): Promise<AuthResponse> {
  logger.info('محاولة تسجيل دخول', { username: req.username });
  // المنطق الفعلي يتم عبر tRPC في الريبو الأصلي
  // هذا المتحكم يعمل كجسر للتوافق مع الكود المرجعي
  return {
    success: false,
    error: 'يجب استخدام tRPC auth بدلاً من هذا المتحكم',
  };
}

export async function logout(): Promise<{ success: boolean }> {
  logger.info('تسجيل خروج');
  return { success: true };
}

export async function validateToken(token: string): Promise<boolean> {
  logger.debug('التحقق من صلاحية التوكن');
  return token.length > 0;
}

export default { login, logout, validateToken };
