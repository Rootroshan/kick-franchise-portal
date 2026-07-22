import { Skeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-4 h-8 w-64" />
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
