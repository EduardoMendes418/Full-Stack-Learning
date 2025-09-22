import { CatchAsyncError } from "./catchAsyncErrors";
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../src/utils/errorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import redisClient from "../src/utils/redis";
import userModel from "../models/user.model";

//AUTHENTICATED 
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.cookies?.access_token;
    const redis = redisClient();

    if (!access_token) {
      return next(
        new ErrorHandler("Por favor, faça login para acessar este recurso", 401)
      );
    }

    if (!process.env.ACCESS_TOKEN) {
      throw new Error("ACCESS_TOKEN não está definido!");
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        access_token,
        process.env.ACCESS_TOKEN
      ) as JwtPayload;
    } catch {
      return next(new ErrorHandler("Token inválido ou expirado", 401));
    }

    if (!decoded) {
      return next(new ErrorHandler("Access token inválido", 401));
    }

      const user = await userModel.findById(decoded.id).select("-password");
    if (!user) {
      return next(new ErrorHandler("Usuário não encontrado", 404));
    }

    req.user = user; 

    next();
  }
);

//VALIDATE USER ROLE 
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || '')) {
      return next(new ErrorHandler(`Acesso negado para o role: ${req.user?.role}`, 403));
    }
    next();  
  };
};