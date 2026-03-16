/**
 * وحدة التسجيل المركزية
 * محول من الحزمة المرجعية للعمل مع بنية الريبو
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private context: string;
  private static instance: Logger;

  constructor(context: string = 'rasid') {
    this.context = context;
  }

  static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      data,
    };

    switch (level) {
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[${entry.timestamp}] [${this.context}] [DEBUG]`, message, data || '');
        }
        break;
      case 'info':
        console.info(`[${entry.timestamp}] [${this.context}] [INFO]`, message, data || '');
        break;
      case 'warn':
        console.warn(`[${entry.timestamp}] [${this.context}] [WARN]`, message, data || '');
        break;
      case 'error':
        console.error(`[${entry.timestamp}] [${this.context}] [ERROR]`, message, data || '');
        break;
    }
  }

  debug(message: string, data?: unknown): void { this.log('debug', message, data); }
  info(message: string, data?: unknown): void { this.log('info', message, data); }
  warn(message: string, data?: unknown): void { this.log('warn', message, data); }
  error(message: string, data?: unknown): void { this.log('error', message, data); }
}

export const logger = Logger.getInstance();
export const createLogger = (context: string) => new Logger(context);
export default logger;
