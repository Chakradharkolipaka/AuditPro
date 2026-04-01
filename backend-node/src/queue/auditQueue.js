import { Queue } from "bullmq";

import { getRedisConnection } from "./redis.js";

let queue;
export const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS || 5);
export const MAX_WAITING_JOBS = Number(process.env.MAX_WAITING_JOBS || 20);

export function getAuditQueue() {
  if (queue) return queue;
  const connection = getRedisConnection();
  queue = new Queue("audit-jobs", {
    connection,
    limiter: {
      max: MAX_CONCURRENT_JOBS,
      duration: 1000,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
  return queue;
}
