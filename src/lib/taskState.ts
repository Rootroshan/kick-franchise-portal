import type { TaskStatus } from "@prisma/client";

/**
 * Display states are DERIVED from (status, dueAt) against server time — the
 * schema only persists OPEN/COMPLETED (spec: Due Today / Overdue are never
 * stored as statuses).
 */
export type TaskDisplayState = "overdue" | "due_today" | "upcoming" | "completed";

export function deriveTaskState(status: TaskStatus, dueAt: Date | null, now = new Date()): TaskDisplayState {
  if (status === "COMPLETED") return "completed";
  if (!dueAt) return "upcoming";
  if (dueAt < now) return "overdue";
  if (
    dueAt.getFullYear() === now.getFullYear() &&
    dueAt.getMonth() === now.getMonth() &&
    dueAt.getDate() === now.getDate()
  ) {
    return "due_today";
  }
  return "upcoming";
}
