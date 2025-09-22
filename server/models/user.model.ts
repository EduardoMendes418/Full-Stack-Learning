require("dotenv").config();
import jwt from "jsonwebtoken";
import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";

const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar: {
    public_id: string;
    url: string;
  };
  role: string;
  isVerified: boolean;
  courses: Array<{ courseId: string }>;
  comparePassword: (password: string) => Promise<Boolean>;
  SignAccessToken: () => string;
  SignRefreshToken: () => string;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "O nome é obrigatório"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "O e-mail é obrigatório"],
      validade: {
        validate: function (value: string) {
          return emailRegexPattern.test(value);
        },
      },
      message: "please enter a valid email",
      unique: true,
    },
    password: {
      type: String,
      required: [true, "A senha é obrigatória"],
      minlength: [6, "A senha deve ter no mínimo 6 caracteres"],
      select: false,
    },
    avatar: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
    role: {
      type: String,
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    courses: [
      {
        courseId: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

userSchema.methods.SignAccessToken = function (): string {
  if (!process.env.ACCESS_TOKEN) {
    throw new Error("ACCESS_TOKEN não está definido nas variáveis de ambiente");
  }

  return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN, {
    expiresIn: "5m",
  });
};

userSchema.methods.SignRefreshToken = function (): string {
  if (!process.env.REFRESH_TOKEN) {
    throw new Error(
      "REFRESH_TOKEN não está definido nas variáveis de ambiente"
    );
  }

  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN, {
    expiresIn: "3d",
  });
};

userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

const userModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default userModel;
