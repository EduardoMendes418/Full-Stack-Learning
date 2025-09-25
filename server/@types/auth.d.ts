import { IUser } from "../models/user.model";

export interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: {
    public_id: string;
    url: string;
  };
}

export interface IActivationToken {
  token: string;
  activationCode: string;
}

export interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ISocialAuthBody {
  email: string;
  name: string;
  avatar?: string; 
}

export interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
