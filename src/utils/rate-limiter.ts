export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = Math.max(0, capacity | 0);
    this.refillRate = Math.max(0, refillRate);
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  consume(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec <= 0) return;
    const tokensToAdd = elapsedSec * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getRetryAfter(): number {
    this.refill();
    const tokensNeeded = 1 - this.tokens;
    if (tokensNeeded <= 0 || this.refillRate <= 0) return 0;
    return Math.ceil(tokensNeeded / this.refillRate);
  }
}

