import { PageSkeleton, TableSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your attempt">
      <div className="split">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={2} />
      </div>
    </PageSkeleton>
  );
}
