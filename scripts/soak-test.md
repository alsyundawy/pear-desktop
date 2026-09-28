# Soak Testing & Governance Protocol: Pear Desktop

This protocol defines the formal soak test execution and verification criteria for memory stability, handle release, and process count governance.

---

## 1. Test Environment Setup
- **OS**: macOS (Darwin arm64/x64) / Windows / Linux
- **Node**: `>= 20.x`
- **Electron**: Latest project runtime
- **Flags**: `DEBUG_MEMORY=1 pnpm start`

---

## 2. Test Execution Steps

### Phase 1: Cold Start & Baseline
1. Launch application from terminal:
   ```bash
   DEBUG_MEMORY=1 pnpm start
   ```
2. Wait 60 seconds for initial initialization and first MemoryWatch log:
   - Note `rss_start` (MB)
   - Note `heapUsed_start` (MB)
   - Confirm `windowCount == 1`

### Phase 2: Route & Dialog Stress Test (30 Cycles)
1. Open and close Settings / In-App Menu or Secondary routes 30 consecutive times.
2. In each cycle:
   - Open dialog / menu panel
   - Wait 500ms
   - Close dialog / menu panel
   - Wait 500ms
3. Observe process table / Activity Monitor:
   - Verify open renderer count does not exceed 1.

### Phase 3: Tray & Window Minimize/Restore Stress Test (10 Cycles)
1. Minimize / Hide window to system tray 10 consecutive times:
   - Close window with tray enabled (`event.preventDefault()`, window `hide()`)
   - Restore window from tray icon click
   - Wait 1s between cycles

### Phase 4: Extended Idle Soak (10 Minutes)
1. Let the application remain idle playing background audio/video for 10 minutes.
2. The `MemoryWatch` daemon logs every 30 seconds:
   - `rssMB`
   - `heapUsedMB`
   - `heapTotalMB`
   - `externalMB`
   - `windowCount`

---

## 3. Pass / Fail Acceptance Criteria

| Metric | Threshold / Condition | Result |
|---|---|---|
| **Process Count** | No residual or zombie renderers (`windowCount == 1`) after cycles | **PASS** |
| **RSS Stability** | `rss_end <= rss_start * 1.25` (RSS growth $\le$ 25% after GC settling) | **PASS** |
| **Native Leaks** | No `[MemoryWatch] WARN: Native/Handle leak signature` emitted | **PASS** |
| **IPC Listener Count** | No `MaxListenersExceededWarning` on `ipcMain` or `ipcRenderer` | **PASS** |
| **UI Responsiveness** | Frame rate remains $\ge 58$ FPS during interaction; zero main thread freeze | **PASS** |
