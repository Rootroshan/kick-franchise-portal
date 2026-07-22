import { CardsSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="space-y-5">
      <CardsSkeleton count={4} variant="stat" />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
