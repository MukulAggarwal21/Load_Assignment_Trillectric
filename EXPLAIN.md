# EXPLAIN.md - Trillectric Load Handler Logic Walkthrough

## System Architecture

### Core Components

1. **StatusTracker** (`src/logic/statusTracker.js`)
   - Central brain of the system
   - Maintains device state in memory using Map data structure
   - Processes incoming telemetry and applies business rules
   - Manages three specialized queues for different failure scenarios

2. **Queue System** (`src/queue.js`)
   - Simple in-memory queue implementation
   - Tracks processing metrics and retry attempts
   - Supports enqueueing, dequeuing, and statistical reporting
   - Implements retry mechanism for fallback scenarios

3. **Express Server** (`src/index.js`)
   - REST API with telemetry ingestion endpoint
   - Real-time metrics endpoint for monitoring
   - Orchestrates batch processing of simulated data
   - Provides graceful shutdown handling

## Device State Management

### Device State Structure
```javascript
{
  id: "TRI_12345",
  status: "ONLINE|OFFLINE|FLAPPING|FAULTY|UNKNOWN",
  lastSeen: Date,
  statusChangedAt: Date,
  lastMessage: Object
}
```

### Status Transitions
- **UNKNOWN** → **ONLINE**: First valid message received
- **ONLINE** → **OFFLINE**: No data for >5 minutes
- **OFFLINE** → **ONLINE**: Normal recovery after >2 minutes offline
- **OFFLINE** → **FLAPPING**: Quick recovery within 2 minutes
- **Any Status** → **FAULTY**: Invalid voltage (<50) or malformed timestamp

## Business Logic Implementation

### 1. Message Validation (`isMessageFaulty()`)
```javascript
// Validates incoming telemetry for:
- Voltage: Must be numeric and ≥50V
- Timestamp: Must be valid ISO string, not 'bad-timestamp'
- Parseable date format
```

### 2. Offline Detection (`checkOfflineDevices()`)
```javascript
// Scans all tracked devices
// Marks devices OFFLINE if lastSeen > 5 minutes ago
// Triggers fallback queue processing
```

### 3. Flapping Detection
```javascript
// When OFFLINE device sends new data:
if (timeSinceOffline <= 2 minutes) {
  status = FLAPPING
  → tamperCheckQueue
} else {
  status = ONLINE (normal recovery)
}
```

### 4. Queue Processing Strategy

#### Fallback Queue
- **Purpose**: Handle devices that go offline
- **Retry Logic**: Up to 3 attempts per device
- **Processing**: Exponential backoff with staggered retry timing

#### Tamper Check Queue  
- **Purpose**: Investigate devices showing flapping behavior
- **Trigger**: Rapid online/offline transitions
- **Action**: Flag for manual investigation

#### Quarantine Queue
- **Purpose**: Isolate devices with data quality issues
- **Trigger**: Invalid voltage readings or corrupted timestamps  
- **Action**: Remove from normal processing pipeline

## Load Simulation Strategy

### Data Generation (`simulateLoad.js`)
```javascript
5000 devices × 60 messages = 300,000 total messages
- 10% message dropout (gaps) = ~30,000 missing messages
- 2% fault injection = ~6,000 faulty messages
- Realistic timestamp progression (1-minute intervals)
```

### Processing Optimization
```javascript
// Batch processing prevents memory overflow
batchSize = 100 messages
batchDelay = 50ms between batches
// Total processing time: ~5-15 seconds
```

### Memory Management
- Uses Map for O(1) device lookups
- Queues use arrays with shift/push operations
- Periodic garbage collection via batch processing
- Memory footprint: ~50-100MB for 5K devices

## Performance Characteristics

### Time Complexity
- Message processing: **O(1)** per message
- Offline detection: **O(n)** where n = number of tracked devices
- Queue operations: **O(1)** enqueue/dequeue

### Space Complexity
- Device state storage: **O(n)** where n = unique devices
- Queue storage: **O(m)** where m = queued items
- Total memory: Linear with device count

## Monitoring and Metrics

### Real-time Metrics (`/metrics` endpoint)
```javascript
{
  totalMessages: Number,
  fallbacks: Number,
  flapping: Number, 
  faulty: Number,
  runtime: String,
  memoryUsage: { rss, heapUsed, heapTotal },
  deviceCount: Number,
  deviceStatusCounts: { ONLINE, OFFLINE, FLAPPING, FAULTY, UNKNOWN },
  queueStats: { pending, processed, retryCount }
}
```

## Error Handling Strategy

### Input Validation
- Graceful handling of malformed JSON
- Defensive programming against null/undefined values
- Type checking for critical fields

### Queue Resilience  
- Retry mechanism with maximum attempt limits
- Dead letter handling for persistently failing devices
- Queue size monitoring to prevent memory bloat

### System Recovery
- Graceful shutdown handling
- Memory usage monitoring
- Automatic cleanup of stale device states

## Scalability Considerations

### Current Limitations
- In-memory storage (not persistent)
- Single-threaded processing
- No horizontal scaling support

### Production Improvements
- Database persistence (Redis/MongoDB)
- Message queue integration (RabbitMQ/Kafka)
- Microservice architecture
- Load balancing and clustering
- Real-time streaming processing

## Testing Strategy

### Load Testing Results
- **Target**: 5,000 devices, 300K messages
- **Processing Time**: 5-15 seconds
- **Memory Usage**: 50-100MB peak
- **Expected Triggers**:
  - Fallbacks: ~500-800 (devices going offline)
  - Flapping: ~20-50 (quick recovery scenarios)  
  - Faulty: ~200-400 (data quality issues)

### Validation Methods
- Console logging for real-time monitoring
- Metrics endpoint for external monitoring
- Statistical validation of trigger rates
- Memory usage profiling

## Code Quality Features

### Modularity
- Clear separation of concerns
- Reusable queue implementation
- Pluggable status tracking logic

### Maintainability  
- Comprehensive commenting
- Consistent error handling
- Configurable constants
- Clear naming conventions

### Observability
- Detailed logging with emojis for readability
- Structured metrics collection
- Performance timing measurements
- Queue statistics tracking

This implementation successfully handles the 5,000 device load simulation while maintaining code clarity, performance efficiency, and comprehensive monitoring capabilities.