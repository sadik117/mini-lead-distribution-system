import { Request, Response, NextFunction } from "express";

// Extend Error to optionally carry an HTTP status code
export interface AppError extends Error {
  statusCode?: number;
  code?: string; // Prisma error codes (e.g. P2002 = unique constraint violation)
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err.message, err.stack);

  // Prisma unique constraint violation → 409 Conflict
  // P2002 is Prisma's error code for unique constraint failures.
  // This handles the case where someone tries to create a duplicate lead
  // (same phone + service) even if the frontend validation is bypassed.
  if (err.code === "P2002") {
    res.status(409).json({
      error: "Duplicate entry",
      message:
        "A lead with this phone number already exists for the selected service.",
    });
    return;
  }

  // error's own statusCode if set, otherwise default to 500
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
  });
}
