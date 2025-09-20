import { CatchAsyncError } from "./../middleware/catchAsyncErrors";
import { Request, Response, NextFunction } from "express";
import userModel from "../models/user.model";
import ErrorHandler from "../src/utils/errorHandler";
import jwt, { Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../src/utils/sendMail";
import { sendToken } from "../src/utils/jwt";

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: {
    public_id: string;
    url: string;
  };
}

interface IActivationToken {
  token: string;
  activationCode: string;
}

interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

interface ILoginRequest {
  email: string;
  password: string;
}

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
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });

      res.clearCookie("refresh_token", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
      
      return res.status(200).json({
        success: true,
        message: "Logout realizado com sucesso",
      });

    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
