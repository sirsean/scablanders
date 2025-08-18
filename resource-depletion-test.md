# Resource Depletion Test Scenario

## Before Testing
1. Start the development server: `npm run dev`
2. Open browser and connect wallet
3. Check initial resource node states in the game

## Test Case 1: Normal Depletion
**Setup:** Find a resource node with `currentYield = 50`
**Action:** Complete a mission that awards 25 units of that resource
**Expected Result:**
- Node's `currentYield` should become 25 (50 - 25)
- Node's `depletion` should increase by 25 
- Node should remain `isActive = true`
- Player should get mission completion notification

## Test Case 2: Over-Extraction (Edge Case)
**Setup:** Find a resource node with `currentYield = 20`
**Action:** Complete a mission that tries to award 30 units 
**Expected Result:**
- Node's `currentYield` should become 0 (takes all remaining)
- Node's `depletion` should increase by 20 (not 30)
- Node should become `isActive = false`
- Player should get both mission completion AND resource depletion notifications

## Test Case 3: Full Depletion
**Setup:** Find a resource node with low `currentYield` (< 30)
**Action:** Complete multiple missions until node is fully depleted
**Expected Result:**
- Final mission should set `currentYield = 0`
- Node should become `isActive = false`
- Player should receive depletion notification
- Node should appear greyed out or inactive in UI

## Verification Points
1. Check browser console logs for depletion messages:
   ```
   [GameDO] Depleting resources from node ore-1 (ore)
   [GameDO] Node before depletion: currentYield=50, depletion=0
   [GameDO] Extracting 25 units (requested: 25, available: 50)
   [GameDO] Node after depletion: currentYield=25, depletion=25
   ```

2. Check WebSocket world_state updates include modified resource nodes

3. Check notifications panel for depletion messages when nodes become inactive

## Quick Dev Test
To quickly test this without waiting for missions:
1. Use the browser dev console to call the API directly:
   ```javascript
   // Get current resource nodes
   fetch('/api/world/resources').then(r => r.json()).then(console.log)
   
   // Complete an existing mission manually (if any active)
   fetch('/api/missions/complete', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ missionId: 'your-mission-id-here' })
   }).then(r => r.json()).then(console.log)
   ```

2. Check that resource nodes have been updated accordingly

## Expected Console Output
```
[GameDO] Depleting resources from node ore-1 (ore)
[GameDO] Node before depletion: currentYield=50, depletion=0
[GameDO] Extracting 25 units (requested: 25, available: 50)
[GameDO] Node after depletion: currentYield=25, depletion=25
```

If a node gets fully depleted:
```
[GameDO] Node ore-1 is now fully depleted and inactive
```
