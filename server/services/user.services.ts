import { Response } from "express";
import redisClient from "../src/utils/redis";

export const getUserById = async (id: string, res: Response) => {
  try {
    const redis = redisClient();
    const userJson = await redis.get(id);

    if (!userJson) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = JSON.parse(userJson);

    return res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};