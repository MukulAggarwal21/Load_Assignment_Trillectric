const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const NUM_DEVICES = 5000;
const MESSAGES_PER_DEVICE = 60; // One hour at 1-min intervals
const GAP_PROBABILITY = 0.10; // 10% chance to skip a message
const FAULT_PROBABILITY = 0.02; // 2% chance of bad voltage/timestamp

const generateTimestamp = (baseTime, offsetMinutes) => {
  return new Date(baseTime.getTime() + offsetMinutes * 60000).toISOString();
};

const randomVoltage = () => {
  if (Math.random() < FAULT_PROBABILITY) return Math.random() < 0.5 ? 0 : 'bad-timestamp';
  return +(210 + Math.random() * 30).toFixed(1);
};

console.log('🔄 Generating device telemetry data...');
const data = [];
const baseTime = new Date('2025-06-02T10:00:00Z');

for (let i = 0; i < NUM_DEVICES; i++) {
  const deviceId = `TRI_${100000 + i}`;
  for (let j = 0; j < MESSAGES_PER_DEVICE; j++) {
    if (Math.random() < GAP_PROBABILITY) continue;

    const voltage = randomVoltage();
    const timestamp = typeof voltage === 'string' ? voltage : generateTimestamp(baseTime, j);

    data.push({
      device_id: deviceId,
      timestamp: timestamp,
      power_kw: +(Math.random() * 5).toFixed(2),
      voltage: voltage
    });
  }
}

// Sort data by timestamp for realistic simulation
data.sort((a, b) => {
  const timeA = a.timestamp === 'bad-timestamp' ? 0 : new Date(a.timestamp).getTime();
  const timeB = b.timestamp === 'bad-timestamp' ? 0 : new Date(b.timestamp).getTime();
  return timeA - timeB;
});

fs.writeFileSync('./device_sample_data.json', JSON.stringify(data, null, 2));

console.log(`✅ Generated ${data.length} telemetry records for ${NUM_DEVICES} devices`);
console.log(`📊 Expected gaps: ~${Math.round(NUM_DEVICES * MESSAGES_PER_DEVICE * GAP_PROBABILITY)}`);
console.log(`⚠️  Expected faults: ~${Math.round(data.length * FAULT_PROBABILITY)}`);
console.log('💾 Data saved to device_sample_data.json');