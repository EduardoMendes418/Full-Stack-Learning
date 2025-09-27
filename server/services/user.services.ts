import { Response } from "express";
import redisClient from "../src/utils/redis";
import userModel from "../models/user.model";

export const getUserById = async (id: string, res: Response) => {
  try {
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const redis = redisClient();
    const userJson = await redis.get(id);

    if (userJson) {
      const userData = JSON.parse(userJson);
      return res.status(200).json({
        success: true,
        user: userData,
      });
    }

    const user = await userModel.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await redis.set(id, JSON.stringify(user), "EX", 3600);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
