import IORedis from "ioredis";

export function getRedisConnection() {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    throw Object.assign(new Error("UPSTASH_REDIS_URL/UPSTASH_REDIS_TOKEN are not set"), { status: 500 });
  }

  // Upstash Redis requires TLS, password is the token.
  return new IORedis(url, {
    password: token,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
