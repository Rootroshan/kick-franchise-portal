"use client";

import { useBulkSelection } from "./BulkSelection";

/** Standalone checkbox for individual rows — use alongside the header select-all. */
export function BulkCheckbox({ id }: { id: string }) {
  const { isSelected, toggle } = useBulkSelection();
  const checked = isSelected(id);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(id)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
      aria-label={`Select item ${id}`}
    />
  );
}

/** Select-all checkbox for the table/list header. */
export function BulkSelectAll({
  allIds,
  totalFiltered,
}: {
  allIds: string[];
  totalFiltered: number;
}) {
  const { isAllOnPageSelected, isSomeOnPageSelected, selectAll, deselectAll } = useBulkSelection();
  const checked = isAllOnPageSelected;
  const indeterminate = isSomeOnPageSelected;

  const handleChange = () => {
    if (checked || indeterminate) deselectAll();
    else selectAll();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={handleChange}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
        aria-label={checked || indeterminate ? "Deselect all on this page" : "Select all on this page"}
      />
      {allIds.length < totalFiltered && (
        <span
          className="cursor-pointer text-[10px] text-muted-foreground underline"
          onClick={() => selectAll()}
          title={`${totalFiltered} items total — click to select all`}
        >
          All {totalFiltered}
        </span>
      )}
    </div>
  );
}
