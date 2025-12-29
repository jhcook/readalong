import { trace, Tracer } from '@opentelemetry/api';

const serviceName = 'readalong-extension';

export function setupTracing(): Tracer {
  // Tracing disabled in production build to prevent side effects
  return trace.getTracer(serviceName);
}

export const tracer = trace.getTracer(serviceName);
