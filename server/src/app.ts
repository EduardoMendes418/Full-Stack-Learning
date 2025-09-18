require("dotenv").config();
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { AppError } from "./errors/AppError";
import ErrorMiddleware from '../middleware/error';

export const app = express();

app.use(express.json({ limit: "50mb" }));

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
  })
);

app.get("/teste", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      success: true,
      message: "API funcionando corretamente!",
      data: { exemplo: "Este é um endpoint de teste" },
    });
  } catch (error) {
    next(error);
  }
});

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    status: "error",
    message: err.message,
  });
});

app.use(ErrorMiddleware);