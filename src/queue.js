// src/queue.js
// Simple in-memory queue implementation

class Queue {
  constructor(name) {
    this.name = name;
    this.items = [];
    this.processed = 0;
    this.retries = new Map(); // Track retry counts
  }

  enqueue(item) {
    this.items.push({
      ...item,
      enqueuedAt: new Date().toISOString(),
      id: `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  dequeue() {
    if (this.items.length === 0) return null;
    const item = this.items.shift();
    this.processed++;
    return item;
  }

  peek() {
    return this.items[0] || null;
  }

  size() {
    return this.items.length;
  }

  getStats() {
    return {
      name: this.name,
      pending: this.items.length,
      processed: this.processed,
      retryCount: this.retries.size
    };
  }

  // Retry mechanism for fallback queue
  retry(deviceId, maxRetries = 3) {
    const currentRetries = this.retries.get(deviceId) || 0;
    if (currentRetries < maxRetries) {
      this.retries.set(deviceId, currentRetries + 1);
      return true;
    }
    return false;
  }

  getRetryCount(deviceId) {
    return this.retries.get(deviceId) || 0;
  }

  clear() {
    this.items = [];
    this.processed = 0;
    this.retries.clear();
  }
}

module.exports = Queue;