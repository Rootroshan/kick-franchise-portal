"use client";

import { BulkSelectionProvider } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { UsersTable } from "@/components/admin/UsersTable";
import { Power, PowerOff, Trash2 } from "lucide-react";
import type { UserRow } from "@/server/modules/users/service";
import {
  bulkActivateUsersAction,
  bulkDeactivateUsersAction,
  bulkDeleteUsersAction,
} from "@/app/admin/users/actions";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";

type Option = { value: string; label: string };

type Props = {
  rows: UserRow[];
  currentUserId: string;
  brandOptions: Option[];
  total: number;
};

const USER_ACTIONS: BulkActionDef[] = [
  {
    key: "activate",
    label: "Activate",
    icon: <Power className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "success",
    action: bulkActivateUsersAction,
  },
  {
    key: "deactivate",
    label: "Deactivate",
    icon: <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "warning",
    action: bulkDeactivateUsersAction,
  },
  {
    key: "delete",
    label: "Delete",
    icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "destructive",
    confirmTitle: "Delete selected users?",
    confirmMessage: "This permanently removes their access. Audit history is preserved.",
    action: bulkDeleteUsersAction,
  },
];

export function UsersListSection({ rows, currentUserId, brandOptions, total }: Props) {
  return (
    <BulkSelectionProvider>
      <UsersListSectionInner rows={rows} currentUserId={currentUserId} brandOptions={brandOptions} total={total} />
    </BulkSelectionProvider>
  );
}

function UsersListSectionInner({ rows, currentUserId, brandOptions, total }: Props) {
  return (
    <>
      <BulkActionToolbar actions={USER_ACTIONS} itemName="user" />
      <UsersTable rows={rows} currentUserId={currentUserId} brandOptions={brandOptions} selectable totalFiltered={total} />
    </>
  );
}
