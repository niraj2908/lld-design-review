import { PageSkeleton, TableSkeleton } from "@/app/_components/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading the review">
      <div className="split">
        <TableSkeleton rows={3} />
        <TableSkeleton rows={2} />
      </div>
    </PageSkeleton>
  );
}
