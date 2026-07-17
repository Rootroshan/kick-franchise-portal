"use server";

import { revalidatePath } from "next/cache";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { updateProfile, profileSchema } from "@/server/modules/franchisor-settings/service";

export async function updateProfileAction(formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = profileSchema.parse({ displayName: formData.get("displayName") });
  await updateProfile(ctx, ctx.tenantId, input);
  revalidatePath("/franchisor/settings");
}
