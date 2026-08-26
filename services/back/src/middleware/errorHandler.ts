import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError, NotFoundError, DatabaseError } from "@/types";
import logger from "@/utils/logger";

/**
 * Express identifies error middleware by arity: it must take four parameters.
 * With three it is treated as ordinary middleware and never receives an error,
 * so every `next(error)` fell through to Express's default handler and answered
 * with an HTML page instead of JSON. `_next` is unused and must stay.
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = "Internal server error";
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;

    if (isOperational) {
      logger.warn("Operational error", {
        error: message,
        statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        body: req.body,
        params: req.params,
        query: req.query,
      });
    }
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    message = error.message;
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    message = error.message;
  } else if (error instanceof DatabaseError) {
    statusCode = 500;
    message = "Database operation failed";
  }

  if (!isOperational) {
    logger.error("Unexpected error", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      body: req.body,
      params: req.params,
      query: req.query,
    });
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error.message,
    }),
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  // NotFoundError appends " not found" itself; passing it too logged
  // "Route / not found not found".
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);
