import { app, BrowserWindow } from 'electron';

interface MemorySample {
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  windowCount: number;
  timestamp: number;
}

const SAMPLE_INTERVAL_MS = 30_000; // >= 30s per governance contract
const MAX_SAMPLES = 10;

let timer: NodeJS.Timeout | null = null;
const samples: MemorySample[] = [];

function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

/**
 * Capture a single memory governance sample and analyze trends.
 */
function recordSample(): void {
  const mem = process.memoryUsage();
  const windowCount = BrowserWindow.getAllWindows().length;

  const currentSample: MemorySample = {
    rssMB: bytesToMB(mem.rss),
    heapUsedMB: bytesToMB(mem.heapUsed),
    heapTotalMB: bytesToMB(mem.heapTotal),
    externalMB: bytesToMB(mem.external),
    windowCount,
    timestamp: Date.now(),
  };

  samples.push(currentSample);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }

  // Verbose trace in dev / debug only; clean formatted info
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MEMORY) {
    console.info(
      `[MemoryWatch] RSS: ${currentSample.rssMB} MB | Heap: ${currentSample.heapUsedMB}/${currentSample.heapTotalMB} MB | Ext: ${currentSample.externalMB} MB | Windows: ${currentSample.windowCount}`,
    );
  }

  // Detect native leak signature: RSS grows > 25% across 10 samples while heapUsed is flat (<= 5% growth)
  if (samples.length >= MAX_SAMPLES) {
    const oldest = samples[0];
    const newest = samples[samples.length - 1];

    if (oldest.rssMB > 0 && oldest.heapUsedMB > 0) {
      const rssGrowthRatio = (newest.rssMB - oldest.rssMB) / oldest.rssMB;
      const heapGrowthRatio =
        (newest.heapUsedMB - oldest.heapUsedMB) / oldest.heapUsedMB;

      if (rssGrowthRatio > 0.25 && heapGrowthRatio <= 0.05) {
        console.warn(
          `[MemoryWatch] WARN: Native/Handle leak signature detected! RSS increased by ${(rssGrowthRatio * 100).toFixed(1)}% ` +
            `(${oldest.rssMB}MB -> ${newest.rssMB}MB) while V8 heap remained flat (${oldest.heapUsedMB}MB -> ${newest.heapUsedMB}MB). ` +
            'Inspect native addons, detached windows, or GPU buffer retention.',
        );
      }
    }
  }
}

/**
 * Start the memory governance watchdog.
 */
export function startMemoryWatch(): void {
  if (timer) return;

  // Record initial baseline
  recordSample();

  timer = setInterval(recordSample, SAMPLE_INTERVAL_MS);
  // Ensure the timer does not prevent the process from exiting
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  app.once('before-quit', stopMemoryWatch);
}

/**
 * Stop the memory governance watchdog.
 */
export function stopMemoryWatch(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
