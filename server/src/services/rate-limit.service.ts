interface RateRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static limits = new Map<string, RateRecord>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  private static ensureCleanupStarted() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.limits.entries()) {
          if (now > record.resetTime) {
            this.limits.delete(key);
          }
        }
      }, 60000);
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  static check(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
    this.ensureCleanupStarted();
    const now = Date.now();
    const existing = this.limits.get(key);

    if (!existing || now > existing.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (existing.count >= max) {
      return { allowed: false, retryAfterMs: Math.max(0, existing.resetTime - now) };
    }

    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
}
