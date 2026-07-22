import { Skeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="max-w-xl space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-28" />
    </div>
  );
}
