import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { formatDate } from "@/lib/utils";
import { sendPushToLocationMembers } from "../push/send";

/**
 * Runs hourly: finds overdue OPEN assignments (dueAt < now) that haven't
 * had a reminder sent yet, fires in-app + push (email fallback inside push
 * send), and stamps reminderSentAt so exactly one reminder goes out per
 * overdue assignment (spec §10.3). Re-runs are no-ops for stamped rows, and
 * the notification dedupe index (user, entity, entityId, category) guards the
 * crash-between-send-and-stamp window against double in-app rows.
 */
export async function sendOverdueTaskReminders() {
  const overdue = await withTenant(systemKickContext(), (tx) =>
    tx.taskAssignment.findMany({
      where: {
        status: "OPEN",
        reminderSentAt: null,
        task: { dueAt: { lt: new Date() } },
      },
      include: { task: true, location: true },
    })
  );

  for (const assignment of overdue) {
    const { task } = assignment;
    const body = task.dueAt ? `${task.title} was due ${formatDate(task.dueAt)}.` : task.title;
    // The reminder deep-links to this store's OWN assignment, so completion
    // stays scoped to one location.
    const href = `/tasks/${assignment.id}`;

    await notifyTenantMembers(systemKickContext(), {
      tenantId: task.tenantId,
      locationId: assignment.locationId,
      role: "FRANCHISEE_USER",
      category: "TASK",
      title: "Task overdue",
      body,
      href,
      entity: "TaskAssignmentOverdue",
      entityId: assignment.id,
    }).catch(() => {
      // In-app fan-out failing must not block push or the stamp below.
    });

    await sendPushToLocationMembers(
      task.tenantId,
      { title: "Task overdue", body, url: href },
      assignment.locationId,
      "TASK"
    );

    await withTenant(systemKickContext(), (tx) =>
      tx.taskAssignment.update({ where: { id: assignment.id }, data: { reminderSentAt: new Date() } })
    );
  }

  return { remindersSent: overdue.length };
}
