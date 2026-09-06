namespace Shared.Kernel;

// Thrown by services to signal a missing resource. Mapped to 404 by the API exception filter.
public sealed class NotFoundException(string message) : Exception(message);

// Thrown by services to signal a conflict with existing state. Mapped to 409.
public sealed class ConflictException(string message) : Exception(message);

// Thrown by services to signal an invalid request that FluentValidation didn't cover
// (e.g. a domain rule violation surfaced as a 400). Mapped to 400.
public sealed class BadRequestException(string message) : Exception(message);

// Thrown by services to signal the caller lacks permission for the resource. Mapped to 403.
public sealed class ForbiddenException() : Exception("Forbidden");

// Thrown by the payment adapter when the payment provider fails. Mapped to 502.
public sealed class PaymentException(string message) : Exception(message);
