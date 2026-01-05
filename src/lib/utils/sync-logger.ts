import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'logs');
const SYNC_LOG_FILE = join(LOG_DIR, 'sync.log');

let logBuffer: string[] = [];

// Initialize a new sync log session (clears previous logs)
export function initSyncLog(): void {
  logBuffer = [];
  logBuffer.push(`=== Sync started at ${new Date().toISOString()} ===\n`);
}

// Add a log entry
export function syncLog(message: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
  const logLine = `[${timestamp}] ${message}`;
  logBuffer.push(logLine);
  // Also log to console
  console.log(message);
}

// Flush logs to file
export function flushSyncLog(): void {
  try {
    // Ensure logs directory exists
    mkdirSync(LOG_DIR, { recursive: true });

    logBuffer.push(`\n=== Sync completed at ${new Date().toISOString()} ===`);
    writeFileSync(SYNC_LOG_FILE, logBuffer.join('\n'), 'utf-8');
  } catch (error) {
    console.error('Failed to write sync log:', error);
  }
}
