
const express = require('express');
const fs = require('fs');
const path = require('path');
const StatusTracker = require('./logic/statusTracker');

const app = express();
const PORT = 3000;

// Initialize status tracker
const statusTracker = new StatusTracker();

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Trillectric Load Handler is running',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = statusTracker.getMetrics();
  const deviceStatusCounts = statusTracker.getDeviceStatusCounts();
  
  res.json({
    ...metrics,
    deviceStatusCounts
  });
});

// Telemetry ingestion endpoint
app.post('/telemetry', (req, res) => {
  try {
    statusTracker.processMessage(req.body);
    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('Error processing telemetry:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Simulate real-time processing
async function simulateRealTimeProcessing() {
  console.log('🏁 Starting Trillectric Load Simulation...');
  
  // Check if data file exists
  const dataFile = path.join(__dirname, '..', 'device_sample_data.json');
  if (!fs.existsSync(dataFile)) {
    console.error('❌ device_sample_data.json not found! Run: npm run simulate');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  console.log(`📊 Loaded ${data.length} telemetry records`);
  
  const startTime = Date.now();
  let processedCount = 0;
  
  // Process messages in batches to simulate real-time
  const batchSize = 100;
  const batchDelay = 50; // ms between batches
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    // Process batch
    for (const message of batch) {
      statusTracker.processMessage(message);
      processedCount++;
    }
    
    // Check for offline devices periodically
    if (i % 1000 === 0) {
      statusTracker.checkOfflineDevices();
    }
    
    // Progress update
    if (i % 5000 === 0) {
      console.log(`⏳ Processed ${processedCount}/${data.length} messages...`);
    }
    
    // Small delay to prevent overwhelming
    if (i < data.length - batchSize) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  // Final offline check
  statusTracker.checkOfflineDevices();
  
  // Process some fallback retries
  console.log('🔄 Processing fallback retries...');
  statusTracker.processFallbackRetries();
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  
  // Final metrics
  console.log('\n📈 SIMULATION COMPLETE - FINAL METRICS:');
  console.log('=' .repeat(50));
  
  const metrics = statusTracker.getMetrics();
  const deviceStatusCounts = statusTracker.getDeviceStatusCounts();
  
  console.log(`⏱️  Total Processing Time: ${totalTime.toFixed(2)}s`);
  console.log(`💾 Memory Usage: ${metrics.memoryUsage.heapUsed} (RSS: ${metrics.memoryUsage.rss})`);
  console.log(`📨 Total Messages Processed: ${metrics.totalMessages}`);
  console.log(`📱 Total Devices Tracked: ${metrics.deviceCount}`);
  console.log('');
  console.log('🚨 TRIGGER COUNTS:');
  console.log(`   📴 Fallbacks (OFFLINE): ${metrics.fallbacks}`);
  console.log(`   🔄 Flapping: ${metrics.flapping}`);
  console.log(`   ⚠️  Faulty: ${metrics.faulty}`);
  console.log('');
  console.log('📊 DEVICE STATUS DISTRIBUTION:');
  Object.entries(deviceStatusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  console.log('');
  console.log('📥 QUEUE STATUS:');
  console.log(`   Fallback Queue: ${metrics.queueStats.fallback.pending} pending, ${metrics.queueStats.fallback.processed} processed`);
  console.log(`   Tamper Check Queue: ${metrics.queueStats.tamperCheck.pending} pending, ${metrics.queueStats.tamperCheck.processed} processed`);
  console.log(`   Quarantine Queue: ${metrics.queueStats.quarantine.pending} pending, ${metrics.queueStats.quarantine.processed} processed`);
  
  console.log('\n🌐 Server running on http://localhost:3000');
  console.log('📊 View live metrics at: http://localhost:3000/metrics');
}

// Start server and simulation
app.listen(PORT, () => {
  console.log(`🚀 Trillectric Load Handler started on port ${PORT}`);
  
  // Start simulation after a brief delay
  setTimeout(() => {
    simulateRealTimeProcessing().catch(console.error);
  }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});