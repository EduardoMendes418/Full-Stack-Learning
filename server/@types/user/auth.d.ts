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

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ISocialAuthBody {
  email: string;
  name: string;
  avatar?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
