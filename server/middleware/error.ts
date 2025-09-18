import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../src/utils/errorHandler";

const ErrorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (err.name === "CastError") {
    error = new ErrorHandler(`Resource not found. Invalid: ${err.path}`, 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    error = new ErrorHandler(`Duplicate value entered for ${field} field`, 400);
  }

  if (err.name === "JsonWebTokenError") {
    error = new ErrorHandler("Invalid token. Please login again.", 401);
  }

  if (err.name === "TokenExpiredError") {
    error = new ErrorHandler(
      "Your token has expired. Please login again.",
      401
    );
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

export default ErrorMiddleware;
