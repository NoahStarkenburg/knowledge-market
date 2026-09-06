using Application.Common;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

// Translates exceptions thrown by the service layer into HTTP responses. Only runs for
// controller actions, so the minimal-API endpoints are unaffected during migration.
public sealed class ApiExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        switch (context.Exception)
        {
            case ValidationException ve:
                var errors = ve.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
                context.Result = new BadRequestObjectResult(new ValidationProblemDetails(errors));
                context.ExceptionHandled = true;
                break;

            case NotFoundException nfe:
                context.Result = new NotFoundObjectResult(new { message = nfe.Message });
                context.ExceptionHandled = true;
                break;

            case ConflictException ce:
                context.Result = new ConflictObjectResult(new { message = ce.Message });
                context.ExceptionHandled = true;
                break;

            case BadRequestException bre:
                context.Result = new BadRequestObjectResult(new { message = bre.Message });
                context.ExceptionHandled = true;
                break;

            case ForbiddenException:
                context.Result = new StatusCodeResult(StatusCodes.Status403Forbidden);
                context.ExceptionHandled = true;
                break;

            case PaymentException pe:
                context.Result = new ObjectResult(new { message = $"Payment provider error: {pe.Message}" })
                { StatusCode = StatusCodes.Status502BadGateway };
                context.ExceptionHandled = true;
                break;

            case KeyNotFoundException:
                context.Result = new NotFoundResult();
                context.ExceptionHandled = true;
                break;

            case ArgumentException ae:
                context.Result = new BadRequestObjectResult(new { message = ae.Message });
                context.ExceptionHandled = true;
                break;
        }
    }
}
