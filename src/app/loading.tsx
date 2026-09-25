import { PageSkeleton, TableSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your workspace">
      <TableSkeleton rows={4} />
    </PageSkeleton>
  );
}
