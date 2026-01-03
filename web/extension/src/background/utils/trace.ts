import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('readalong-extension');

/**
 * Wraps an async function in an OpenTelemetry active span.
 * Handles span creation, error recording, status setting, and ending.
 * 
 * @param name Span name
 * @param fn Async function to execute, receiving the span as argument
 * @returns Result of the function
 */
export async function traceAsync<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
        try {
            const result = await fn(span);
            span.end();
            return result;
        } catch (err: any) {
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
            span.end();
            throw err;
        }
    });
}
