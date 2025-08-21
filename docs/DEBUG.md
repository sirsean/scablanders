# Scablanders Client Debugging Guide

This document describes the debugging tools and functions available for troubleshooting the client-side resource management system.

## 🔧 Available Debug Functions

The following functions are automatically loaded in the browser console when running the game client:

### `debugResourceFlow()`

**Purpose**: Quick diagnostic check of the current resource management state.

**Usage**:
```javascript
debugResourceFlow()
```

**Output**:
```
🔧 Resource Management Debug Info
========================================
📊 Current State:
   Resource nodes: 8
   WebSocket connected: true
   WebSocket authenticated: true
   Real-time mode: true
   Connection status: connected

📦 Resource Nodes:
   ore (common) - 35/40 at (234, 456)
   ore (rare) - 78/80 at (567, 234)
   scrap (uncommon) - 65/75 at (345, 678)
   ...
```

**Returns**: Object with `currentState` property containing the full game state.

---

### `testResourceManagement()`

**Purpose**: End-to-end test of the complete resource degradation flow from server to client.

**Usage**:
```javascript
await testResourceManagement()
```

**Process**:
1. **State Check**: Validates WebSocket connection and authentication
2. **Server Trigger**: Manually triggers resource management on the server
3. **Update Monitor**: Waits up to 10 seconds for WebSocket updates
4. **Results Analysis**: Reports on node count changes and yield updates

**Expected Output**:
```
🔧 Starting Resource Management Debug Test
==================================================
📊 Step 1: Checking initial game state
   Initial resource nodes: 8
   WebSocket connected: true
   WebSocket authenticated: true
   Real-time mode: true

⚡ Step 2: Triggering resource management on server
   ✅ Server response: {success: true, summary: "Resource management completed. Nodes: 9 -> 8, Active: 8 -> 8"}

⏳ Step 3: Waiting for WebSocket updates...
   ✅ State update received after 123ms
   New resource nodes: 8
   🎉 SUCCESS: Resource count changed from 8 to 8
   ✅ Found 3 nodes with updated yields
```

**Returns**: Promise that resolves to `true` on success, `false` on failure.

---

## 🚨 Troubleshooting Common Issues

### Issue: "WebSocket not authenticated"

**Symptoms**:
```
❌ WebSocket not authenticated. Resource updates may not be received.
```

**Solutions**:
1. Ensure you're logged in with your wallet
2. Check browser console for authentication errors
3. Try refreshing the page
4. Verify the WebSocket connection in Network tab

---

### Issue: "No state update received within 10 seconds"

**Symptoms**:
```
❌ No state update received within 10 seconds
   Possible issues:
   - WebSocket connection lost
   - Server not broadcasting updates
   - Resource management not making changes
```

**Debugging Steps**:
1. Check WebSocket status with `debugResourceFlow()`
2. Verify server logs for resource management execution
3. Check if resource nodes have any yield remaining to degrade
4. Ensure the Durable Object alarm system is working

---

### Issue: "No changes detected in resource nodes"

**Symptoms**:
```
⚠️ No changes detected in resource nodes
```

**Possible Causes**:
- All nodes are at minimum degradation levels
- Time elapsed since last update is too small
- Degradation rate configuration is too low
- Resource management isn't running as expected

**Solutions**:
1. Wait longer between tests (degradation is time-based)
2. Check server degradation rate configuration
3. Verify server alarm scheduling is working

---

## 🔍 Debug Console Output

### GameScene Resource Updates

When resource nodes are updated, you'll see detailed logging in the console:

```
[GameScene] 🔄 Processing resource node updates:
[GameScene]   - Server has 8 nodes
[GameScene]   - Client has 9 nodes
[GameScene] ❌ Removing deleted node: ore-1234567890-abc123
[GameScene] ✨ Creating new resource node: scrap-0987654321-def456 (scrap, 50 yield)
[GameScene] Updating node ore-2345678901-ghi789 yield: 35
[GameScene] 🏁 Resource update complete. Client now has 8 nodes
```

### GameState WebSocket Events

The game state manager logs WebSocket events:

```
[GameState] Received world state update: {resourceNodes: Array(8), missions: Array(2), worldMetrics: {...}}
[GameState] Updating resource nodes from WebSocket: Array(8)
```

### Server Broadcasts

Server-side logging shows broadcast activities:

```
[GameDO] Broadcasting world state update to all clients (8 active nodes)
[GameDO] Sent world state update to session abc-123-def
```

---

## 🎮 Interactive Testing

### Manual Testing Workflow

1. **Initial Check**:
   ```javascript
   debugResourceFlow()
   ```

2. **Trigger Update**:
   ```javascript
   await testResourceManagement()
   ```

3. **Monitor Changes**:
   - Watch the game map for visual updates
   - Check console for detailed logging
   - Verify node counts match between server/client

4. **Repeat Testing**:
   ```javascript
   // Wait a few seconds, then test again
   setTimeout(() => testResourceManagement(), 5000)
   ```

### Rapid Testing (Multiple Triggers)

```javascript
// Test multiple degradation cycles quickly
for (let i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(`--- Test Run ${i + 1} ---`);
    testResourceManagement();
  }, i * 2000);
}
```

---

## 📊 Resource Management Configuration

The current system configuration:

- **Target Nodes**: 8 total (3 ore, 3 scrap, 2 organic)
- **Degradation Rate**: 10% per hour
- **Check Interval**: 15 minutes
- **Minimum Degradation**: 1 point per cycle (ensures steady degradation)
- **Spawn Area**: Full map with 30px margins

### Key Behaviors

1. **Time-Based Degradation**: Yield decreases based on elapsed time
2. **Immediate Removal**: Nodes with 0 yield are deleted immediately
3. **Automatic Replacement**: New nodes spawn to maintain target counts
4. **Anti-Overlap**: New nodes spawn at least 40px apart
5. **Real-Time Updates**: Changes broadcast immediately via WebSocket

---

## 🛠️ Development Tips

### Adding Custom Debug Points

To add your own debugging:

```javascript
// Listen for specific state changes
gameState.onStateChange((state) => {
  if (state.resourceNodes?.length !== previousCount) {
    console.log('Resource count changed!', state.resourceNodes?.length);
  }
});
```

### Testing Specific Scenarios

```javascript
// Test with different degradation rates
fetch('/api/world/debug/trigger-resource-management', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log);
```

### Performance Monitoring

```javascript
// Monitor update performance
console.time('resource-update');
await testResourceManagement();
console.timeEnd('resource-update');
```

---

## 📝 Expected Log Patterns

### Successful Operation
```
🔧 Starting Resource Management Debug Test
📊 Step 1: Checking initial game state ✓
⚡ Step 2: Triggering resource management on server ✓
⏳ Step 3: Waiting for WebSocket updates...
✅ State update received after 89ms
🎉 SUCCESS: Found 2 nodes with updated yields
```

### System Issues
```
❌ WebSocket not authenticated
❌ Failed to trigger resource management: 500 Internal Server Error
❌ No state update received within 10 seconds
```

---

This debugging system provides comprehensive visibility into the resource management flow and helps identify issues at any point in the server → WebSocket → client update pipeline.
