import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { sendPushToLocationMembers } from "../push/send";

/**
 * Runs hourly: finds overdue OPEN assignments (dueAt < now) that haven't
 * had a reminder sent yet, fires push+email, and stamps reminderSentAt so
 * exactly one reminder goes out per overdue assignment (spec §10.3).
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
    await sendPushToLocationMembers(
      assignment.task.tenantId,
      { title: "Overdue task", body: assignment.task.title, url: `/tasks/${assignment.taskId}` },
      assignment.locationId
    );

    await withTenant(systemKickContext(), (tx) =>
      tx.taskAssignment.update({ where: { id: assignment.id }, data: { reminderSentAt: new Date() } })
    );
  }

  return { remindersSent: overdue.length };
}
