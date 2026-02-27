// Performance monitoring utilities for SolarScope AI

interface PerformanceMetrics {
  component: string;
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100;

  startTimer(
    component: string,
    operation: string,
  ): (success?: boolean, error?: string) => void {
    const startTime = performance.now();

    return (success: boolean = true, error?: string) => {
      const duration = performance.now() - startTime;

      this.addMetric({
        component,
        operation,
        duration,
        timestamp: Date.now(),
        success,
        error,
      });

      // Log slow operations (>2 seconds)
      if (duration > 2000) {
        console.warn(
          `Slow operation detected: ${component}.${operation} took ${duration.toFixed(2)}ms`,
        );
      }
    };
  }

  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Start a performance timer for a component operation.
 * Call the returned function to stop the timer and record the metric.
 */
export function measureTime(
  component: string,
  operation: string,
): (success?: boolean, error?: string) => void {
  return performanceMonitor.startTimer(component, operation);
}
