/**
 * محاكاة Redis للتخزين المؤقت المحلي
 * يستخدم Map في الذاكرة بدلاً من Redis الخارجي
 * للعمل مع بنية الريبو المحلية (sql.js)
 */

class LocalCache {
  private store: Map<string, { value: string; expiry?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async flushAll(): Promise<void> {
    this.store.clear();
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

export const redis = new LocalCache();
export const cacheClient = redis;
export default redis;
