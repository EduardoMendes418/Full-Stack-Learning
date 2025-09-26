import { getUserById } from "./../services/user.services";
import { CatchAsyncError } from "./../middleware/catchAsyncErrors";
import { Request, Response, NextFunction } from "express";
import userModel from "../models/user.model";
import ErrorHandler from "../src/utils/errorHandler";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../src/utils/sendMail";
import { sendToken } from "../src/utils/jwt";
import redisClient from "../src/utils/redis";
import bcrypt from "bcryptjs";
import {
  IRegistrationBody,
  IActivationRequest,
  ILoginRequest,
  IActivationToken,
  ISocialAuthBody,
  IUpdateUserInfo,
} from "../@types/auth.d";

//GERACAO DE TOKEN
export const createActivationToken = (
  user: IRegistrationBody
): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret,
    { expiresIn: "1h" }
  );

  return { activationCode, token };
};

//CRIAÇÃO DE USUARIO
export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, avatar } = req.body;

    const isEmailExist = await userModel.findOne({ email });
    if (isEmailExist) {
      return next(new ErrorHandler("Usuário já existe com esse email", 400));
    }

    const user: IRegistrationBody = { name, email, password, avatar };

    const activationToken = createActivationToken(user);
    const activationCode = activationToken.activationCode;

    const data = { user: user.name, activationCode };
    await ejs.renderFile(
      path.join(__dirname, "../mails/activation-mail.ejs"),
      data
    );

    try {
      await sendMail({
        email: user.email,
        subject: "Ative sua conta",
        template: "activation-mail.ejs",
        data,
      });

      res.status(201).json({
        success: true,
        message: `Verifique seu e-mail: ${user.email} para ativar sua conta`,
        activationToken: activationToken.token,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//ATIVAÇÃO DE USUARIO
export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const decoded = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IRegistrationBody; activationCode: string };

      if (decoded.activationCode !== activation_code) {
        return next(new ErrorHandler("Código de ativação inválido", 400));
      }

      const { name, email, password, avatar } = decoded.user;

      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler("Email já existe", 400));
      }

      const defaultAvatar = {
        public_id: "default_avatar_id",
        url: "https://exemplo.com/default-avatar.png",
      };

      await userModel.create({
        name,
        email,
        password,
        avatar: avatar || defaultAvatar,
      });

      res.status(201).json({
        success: true,
        message: "Usuário ativado com sucesso",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message || "Algo deu errado", 400));
    }
  }
);

//LOGIN
export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(
          new ErrorHandler("Por favor, informe o e-mail e a senha", 400)
        );
      }

      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler("E-mail ou senha inválidos", 400));
      }

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Senha incorreta", 400));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//LOGOUT USER
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie("access_token", {
        maxAge: 1,
      });

      res.clearCookie("refresh_token", {
        maxAge: 1,
      });

      const userId = req.user?._id?.toString();
      if (userId) {
        const redis = redisClient();
        await redis.del(userId);
      }

      return res.status(200).json({
        success: true,
        message: "Logout realizado com sucesso",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//UPDATE ACCESS TOKEN
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      const message = "Não foi possível atualizar o token";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }

      const client = redisClient();
      const session = await client.get(decoded.id as string);

      if (!session) {
        return next(new ErrorHandler(message, 400));
      }

      const accessToken = jwt.sign(
        { id: decoded.id },
        process.env.ACCESS_TOKEN as string,
        { expiresIn: "5m" }
      );

      const refreshToken = jwt.sign(
        { id: decoded.id },
        process.env.REFRESH_TOKEN as string,
        { expiresIn: "3d" }
      );

      const accessTokenOptions = {
        expires: new Date(Date.now() + 5 * 60 * 1000),
        httpOnly: true,
        sameSite: "lax" as const,
      };

      const refreshTokenOptions = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: "lax" as const,
      };

      req.user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      return res.status(200).json({
        success: true,
        accessToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// GET USER INFO
export const getUserInfo = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new ErrorHandler("ID do usuário não encontrado", 400));
    }
    getUserById(userId.toString(), res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
};

// SOCIAL AUTH
export const socialAuth = async (
  req: Request<{}, {}, ISocialAuthBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, avatar } = req.body;

    if (!email || !name) {
      return next(new ErrorHandler("Email e nome são obrigatórios", 400));
    }

    let user = await userModel.findOne({ email });

    if (!user) {
      user = await userModel.create({
        email,
        name,
        avatar: {
          public_id: "social_" + Date.now(),
          url: avatar || "https://cdn.suaapp.com/default-avatar.png",
        },
      });
    }

    sendToken(user, 200, res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
};

//UPDATE USER INFO
export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user._id) {
        return next(new ErrorHandler("Usuário não autenticado", 401));
      }

      const { name, email } = req.body as IUpdateUserInfo;
      const userId = req.user._id.toString();

      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("Usuário não encontrado", 404));
      }

      const redis = redisClient();

      if (email) {
        const emailExistente = await userModel.findOne({ email });
        if (emailExistente && emailExistente._id.toString() !== userId) {
          return next(new ErrorHandler("O email já está em uso", 400));
        }
        user.email = email;
      }

      if (name) {
        user.name = name;
      }

      await user.save();
      await redis.set(userId, JSON.stringify(user));

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//UPDATE PASSWORD
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user._id) {
        return next(new ErrorHandler("Usuário não autenticado", 401));
      }

      const { oldPassword, newPassword } = req.body as IUpdatePassword;
      const userId = req.user._id.toString();

      const user = await userModel.findById(userId).select("+password");
      if (!user) {
        return next(new ErrorHandler("Usuário não encontrado", 404));
      }

      if (!user.password) {
        return next(new ErrorHandler("Senha do usuário não encontrada", 500));
      }

      const isPasswordMatch = await user.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Senha antiga incorreta", 400));
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      const { password, ...userToCache } = user.toObject();
      const redis = redisClient();
      await redis.set(userId, JSON.stringify(userToCache));

      return res.status(200).json({
        success: true,
        message: "Senha atualizada com sucesso",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
