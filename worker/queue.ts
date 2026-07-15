import { Queue, type ConnectionOptions } from "bullmq";
import { getEnv } from "@/lib/env";

function redisConnection(): ConnectionOptions {
  const url = new URL(getEnv().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export const QUEUE_NAME = "kick-portal";

let queue: Queue | null = null;
export function getQueue(): Queue {
  if (queue) return queue;
  queue = new Queue(QUEUE_NAME, { connection: redisConnection() });
  return queue;
}

export { redisConnection };
