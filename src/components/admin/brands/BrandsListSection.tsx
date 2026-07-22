"use client";

import { BulkSelectionProvider } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { BrandsList } from "@/components/admin/BrandsList";
import { Power, PowerOff, Trash2 } from "lucide-react";
import type { BrandRow } from "@/server/modules/tenants/brands";
import {
  bulkActivateBrandsAction,
  bulkDeactivateBrandsAction,
  bulkDeleteBrandsAction,
} from "@/app/admin/brands/actions";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";

type Props = {
  rows: BrandRow[];
  total: number;
};

const BRAND_ACTIONS: BulkActionDef[] = [
  {
    key: "activate",
    label: "Activate",
    icon: <Power className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "success",
    action: bulkActivateBrandsAction,
  },
  {
    key: "deactivate",
    label: "Deactivate",
    icon: <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "warning",
    action: bulkDeactivateBrandsAction,
  },
  {
    key: "delete",
    label: "Delete",
    icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "destructive",
    confirmTitle: "Delete selected brands?",
    confirmMessage:
      "Brands with stores, members, orders, payments, or history will be skipped. Only empty brands can be permanently deleted.",
    action: bulkDeleteBrandsAction,
  },
];

/**
 * Client wrapper: provides BulkSelectionProvider context + bulk toolbar.
 * The server component passes rows/total; this handles all interactive state.
 */
export function BrandsListSection({ rows, total }: Props) {
  return (
    <BulkSelectionProvider>
      <BrandsListSectionInner rows={rows} total={total} />
    </BulkSelectionProvider>
  );
}

function BrandsListSectionInner({ rows, total }: Props) {
  return (
    <>
      <BulkActionToolbar actions={BRAND_ACTIONS} itemName="brand" />
      {/* BrandsList is a client component that consumes BulkSelectionProvider */}
      <BrandsList rows={rows} selectable totalFiltered={total} />
    </>
  );
}
