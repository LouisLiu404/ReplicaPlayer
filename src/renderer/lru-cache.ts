export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new Error("LruCache maxSize must be greater than zero");
    }
  }

  clear(): void {
    this.entries.clear();
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, value);

    while (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
