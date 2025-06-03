// src/logic/statusTracker.js
// Core logic for tracking device status and triggering actions

const Queue = require('../queue');

class StatusTracker {
  constructor() {
    this.devices = new Map(); // deviceId -> device state
    this.fallbackQueue = new Queue('fallback');
    this.tamperCheckQueue = new Queue('tamperCheck');
    this.quarantineQueue = new Queue('quarantine');
    
    this.metrics = {
      totalMessages: 0,
      fallbacks: 0,
      flapping: 0,
      faulty: 0,
      startTime: Date.now()
    };
  }

  processMessage(payload) {
    this.metrics.totalMessages++;
    
    const { device_id, timestamp, power_kw, voltage } = payload;
    const now = new Date();
    
    // Validate message format
    if (this.isMessageFaulty(payload)) {
      this.handleFaultyDevice(device_id, 'Invalid voltage or timestamp');
      return;
    }

    const messageTime = new Date(timestamp);
    const deviceState = this.getOrCreateDevice(device_id);
    
    // Update device last seen
    deviceState.lastSeen = messageTime;
    deviceState.lastMessage = payload;
    
    // Check if device was previously OFFLINE
    if (deviceState.status === 'OFFLINE') {
      const offlineDuration = (messageTime - deviceState.statusChangedAt) / 1000 / 60; // minutes
      
      if (offlineDuration <= 2) {
        // Device came back within 2 minutes - FLAPPING
        this.handleFlappingDevice(device_id);
      } else {
        // Device recovered normally
        deviceState.status = 'ONLINE';
        deviceState.statusChangedAt = messageTime;
      }
    } else {
      // Device is functioning normally
      deviceState.status = 'ONLINE';
      if (!deviceState.statusChangedAt) {
        deviceState.statusChangedAt = messageTime;
      }
    }
  }

  checkOfflineDevices() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    for (const [deviceId, deviceState] of this.devices) {
      if (deviceState.status !== 'OFFLINE' && deviceState.lastSeen < fiveMinutesAgo) {
        this.handleOfflineDevice(deviceId);
      }
    }
  }

  isMessageFaulty(payload) {
    const { voltage, timestamp } = payload;
    
    // Check voltage
    if (typeof voltage !== 'number' || voltage < 50) {
      return true;
    }
    
    // Check timestamp format
    if (typeof timestamp !== 'string' || timestamp === 'bad-timestamp') {
      return true;
    }
    
    // Validate timestamp is parseable
    const parsedTime = new Date(timestamp);
    if (isNaN(parsedTime.getTime())) {
      return true;
    }
    
    return false;
  }

  getOrCreateDevice(deviceId) {
    if (!this.devices.has(deviceId)) {
      this.devices.set(deviceId, {
        id: deviceId,
        status: 'UNKNOWN',
        lastSeen: null,
        statusChangedAt: null,
        lastMessage: null
      });
    }
    return this.devices.get(deviceId);
  }

  handleOfflineDevice(deviceId) {
    const deviceState = this.getOrCreateDevice(deviceId);
    deviceState.status = 'OFFLINE';
    deviceState.statusChangedAt = new Date();
    
    this.fallbackQueue.enqueue({
      deviceId,
      reason: 'No data for more than 5 minutes',
      timestamp: new Date().toISOString()
    });
    
    this.metrics.fallbacks++;
    console.log(`📴 Device ${deviceId} marked OFFLINE - sent to fallback queue`);
  }

  handleFlappingDevice(deviceId) {
    const deviceState = this.getOrCreateDevice(deviceId);
    deviceState.status = 'FLAPPING';
    deviceState.statusChangedAt = new Date();
    
    this.tamperCheckQueue.enqueue({
      deviceId,
      reason: 'Device came online within 2 minutes of going offline',
      timestamp: new Date().toISOString()
    });
    
    this.metrics.flapping++;
    console.log(`🔄 Device ${deviceId} marked FLAPPING - sent to tamper check queue`);
  }

  handleFaultyDevice(deviceId, reason) {
    const deviceState = this.getOrCreateDevice(deviceId);
    deviceState.status = 'FAULTY';
    deviceState.statusChangedAt = new Date();
    
    this.quarantineQueue.enqueue({
      deviceId,
      reason,
      timestamp: new Date().toISOString()
    });
    
    this.metrics.faulty++;
    console.log(`⚠️  Device ${deviceId} marked FAULTY - sent to quarantine queue`);
  }

  // Process retry logic for fallback queue
  processFallbackRetries() {
    let retryCount = 0;
    const maxRetries = 3;
    
    // Process some items from fallback queue
    while (this.fallbackQueue.size() > 0 && retryCount < 100) {
      const item = this.fallbackQueue.dequeue();
      if (item) {
        const canRetry = this.fallbackQueue.retry(item.deviceId, maxRetries);
        if (canRetry) {
          // Simulate retry logic - re-enqueue with delay
          setTimeout(() => {
            const currentRetries = this.fallbackQueue.getRetryCount(item.deviceId);
            console.log(`🔄 Retrying fallback for ${item.deviceId} (attempt ${currentRetries}/${maxRetries})`);
            
            if (currentRetries < maxRetries) {
              this.fallbackQueue.enqueue({
                ...item,
                retryAttempt: currentRetries
              });
            }
          }, 1000 * (retryCount + 1)); // Stagger retries
        }
        retryCount++;
      }
    }
  }

  getMetrics() {
    const runtime = (Date.now() - this.metrics.startTime) / 1000;
    const memUsage = process.memoryUsage();
    
    return {
      ...this.metrics,
      runtime: `${runtime.toFixed(2)}s`,
      memoryUsage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      },
      deviceCount: this.devices.size,
      queueStats: {
        fallback: this.fallbackQueue.getStats(),
        tamperCheck: this.tamperCheckQueue.getStats(),
        quarantine: this.quarantineQueue.getStats()
      }
    };
  }

  getDeviceStatusCounts() {
    const statusCounts = {
      ONLINE: 0,
      OFFLINE: 0,
      FLAPPING: 0,
      FAULTY: 0,
      UNKNOWN: 0
    };

    for (const [, deviceState] of this.devices) {
      statusCounts[deviceState.status] = (statusCounts[deviceState.status] || 0) + 1;
    }

    return statusCounts;
  }
}

module.exports = StatusTracker;