namespace Api.Observability;

// Shared identity and noise rules for the telemetry pipeline, so traces, metrics and
// logs all agree on who this service is and what isn't worth recording.
public static class ObservabilityDefaults
{
    public const string ServiceName = "KnowledgeMarket.Api";
    public const string ServiceVersion = "1.0.0";

    // Liveness/readiness probes run on a timer forever. They are real HTTP requests, but
    // recording them means a trace every 30 seconds per replica and a request-log line to
    // match — noise that crowds out the traffic you actually want to see.
    public static bool IsProbePath(PathString path) =>
        path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase);
}
