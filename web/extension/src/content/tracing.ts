import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, Tracer } from '@opentelemetry/api';

const serviceName = 'readalong-extension';

const ENABLE_TRACING = false; // Set to true if you have a local OTel collector running

export function setupTracing(): Tracer {
  const spanProcessors = [];

  if (ENABLE_TRACING) {
    const exporter = new OTLPTraceExporter({
      url: 'https://localhost:4318/v1/traces',
    });
    spanProcessors.push(new BatchSpanProcessor(exporter));
  }

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    spanProcessors: spanProcessors,
  });

  provider.register();

  return trace.getTracer(serviceName);
}

export const tracer = trace.getTracer(serviceName);
