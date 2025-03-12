import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GqlContextType, GqlArgumentsHost } from '@nestjs/graphql';
import { ErrorResponse } from '../interfaces';

/**
 * Global filter to catch all exceptions (including non-HTTP exceptions)
 * and format them consistently for both REST and GraphQL endpoints.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    let statusCode: number;
    let errorMessage: string;
    let errorType: string;
    let errorDetails: Record<string, any> | null = null;
    let path: string;

    // Determine the context type (HTTP or GraphQL)
    if (host.getType<GqlContextType>() === 'graphql') {
      // For GraphQL, we don't handle the response here since Apollo handles it
      // Just do the logging part and let the GraphQL error formatter handle the rest
      this.handleGraphQLError(exception);
      return;
    }

    // Handle HTTP contexts
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    path = request.url;

    // Process the exception based on its type
    if (exception instanceof HttpException) {
      // For HTTP exceptions, use the built-in status and response
      statusCode = exception.getStatus();
      const errorResponse = exception.getResponse() as any;

      if (typeof errorResponse === 'object') {
        errorMessage = errorResponse.message || exception.message;
        errorType =
          errorResponse.error || this.getErrorTypeFromStatus(statusCode);
        const { message, error, ...rest } = errorResponse;
        if (Object.keys(rest).length) {
          errorDetails = rest;
        }
      } else {
        errorMessage = errorResponse || exception.message;
        errorType = this.getErrorTypeFromStatus(statusCode);
      }
    } else if (exception instanceof Error) {
      // For standard JS errors, map to 500 Internal Server Error
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message;
      errorType = 'Internal Server Error';

      // Capture additional information in development mode
      if (process.env.NODE_ENV !== 'production') {
        errorDetails = {
          name: exception.name,
        };
      }
    } else {
      // For unknown exception types
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'An unexpected error occurred';
      errorType = 'Internal Server Error';
    }

    // Create standardized error response
    const errorResponse: ErrorResponse = {
      statusCode,
      message: errorMessage,
      error: errorType,
      details: errorDetails,
      timestamp: new Date().toISOString(),
      path,
    };

    // Log all non-401/403 errors
    if (
      statusCode !== HttpStatus.UNAUTHORIZED &&
      statusCode !== HttpStatus.FORBIDDEN
    ) {
      this.logger.error(
        `${request.method} ${path} ${statusCode}: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Send the error response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Handle GraphQL-specific error logging
   */
  private handleGraphQLError(exception: unknown): void {
    // Just log the error - the actual formatting is done in the formatError handler in GraphQL setup
    if (exception instanceof Error) {
      if (
        !(exception instanceof HttpException) ||
        (exception.getStatus() !== HttpStatus.UNAUTHORIZED &&
          exception.getStatus() !== HttpStatus.FORBIDDEN)
      ) {
        this.logger.error(
          `GraphQL error: ${exception.message}`,
          exception.stack,
        );
      }
    } else {
      this.logger.error(`Unknown GraphQL error: ${exception}`);
    }
  }

  /**
   * Map HTTP status code to error type string
   */
  private getErrorTypeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Validation Error';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      default:
        return `HTTP Error ${status}`;
    }
  }
}
