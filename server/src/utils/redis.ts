import { Redis } from 'ioredis';
require('dotenv').config();

let redis: Redis | null = null;

const redisClient = (): Redis => {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('A variável de ambiente REDIS_URL não está definida.');
    }

    redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => {
      console.log('✅ Conectado ao Redis com sucesso!');
    });

    redis.on('error', (err) => {
      console.error('❌ Erro ao conectar ao Redis:', err);
    });
  }

  return redis;
};

export default redisClient;