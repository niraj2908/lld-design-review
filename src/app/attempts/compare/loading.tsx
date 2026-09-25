import { PageSkeleton, TableSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading the comparison">
      <TableSkeleton rows={5} />
    </PageSkeleton>
  );
}
