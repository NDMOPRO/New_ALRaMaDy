/**
 * معالج الأخطاء المركزي
 * محول من Express middleware إلى دالة مستقلة
 */

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AppError) {
    return { message: error.message, statusCode: error.statusCode };
  }
  if (error instanceof Error) {
    return { message: error.message, statusCode: 500 };
  }
  return { message: 'خطأ غير معروف', statusCode: 500 };
}

export function asyncHandler<T>(fn: (...args: any[]) => Promise<T>) {
  return (...args: any[]) => {
    return Promise.resolve(fn(...args)).catch((err) => {
      const handled = handleError(err);
      throw new AppError(handled.message, handled.statusCode);
    });
  };
}

export default { AppError, handleError, asyncHandler };
