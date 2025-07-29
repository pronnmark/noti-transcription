import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export debug utilities
export {
  debugLog,
  createDebugLogger,
  apiDebug,
  workerDebug,
  servicesDebug,
  debugPerformance,
  debugError,
  type DebugContext,
} from './utils/debug';
