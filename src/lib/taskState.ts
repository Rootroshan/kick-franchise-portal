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

// Plain data, not JSX — lives outside TasksToolbar's "use client" module so
// the server page can read it directly. Importing a value from a client
// module works in dev but throws in the production server bundle ("Attempted
// to call some() from the server but some is on the client"), since Next
// replaces the client module's exports with a client-reference proxy.
export const TASK_TABS = [
  { value: "", label: "All Tasks" },
  { value: "open", label: "Open" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
] as const;

export type TaskTab = (typeof TASK_TABS)[number]["value"];

export const TASK_SORTS = [
  { value: "", label: "Sort: Due date" },
  { value: "newest", label: "Sort: Newest" },
  { value: "oldest", label: "Sort: Oldest" },
  { value: "completed", label: "Sort: Completion date" },
] as const;

export type TaskSort = (typeof TASK_SORTS)[number]["value"];
