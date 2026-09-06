using System.Diagnostics;

namespace Shared.Kernel;

// Custom spans for the operations that matter to the business but that no automatic
// instrumentation can see: a purchase, a checkout, a cache lookup, a coalesced call.
// The API registers this source with OpenTelemetry, so these nest inside the ASP.NET
// Core request span and show up in the Tempo waterfall next to the SQL and HTTP spans.
public static class AppDiagnostics
{
    public const string SourceName = "KnowledgeMarket";

    public static readonly ActivitySource Source = new(SourceName, "1.0.0");

    public static Activity? Start(string name, ActivityKind kind = ActivityKind.Internal) =>
        Source.StartActivity(name, kind);
}
