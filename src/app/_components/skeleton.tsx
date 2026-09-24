/**
 * Loading placeholders whose shapes match the page that is coming.
 *
 * Every page here is `force-dynamic` and reads PostgreSQL, so there is a real gap
 * between navigation and first paint. A shape that matches the eventual layout keeps
 * the page from jumping when the data lands; a centred "Loading…" would not.
 */
export function TableSkeleton({ rows = 4 }: { readonly rows?: number }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <div className="panel-head">
        <span className="skeleton skeleton-line" style={{ width: "8ch" }} />
      </div>
      <div className="panel-body">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton-row">
            <span className="skeleton skeleton-line" style={{ width: "38%" }} />
            <span className="skeleton skeleton-line" style={{ width: "62%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  label,
  children,
}: {
  readonly label: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <>
      <div className="page-head">
        <div className="grow">
          <span
            className="skeleton skeleton-title"
            role="status"
            aria-label={label}
          />
          <span className="skeleton skeleton-line" style={{ width: "48%" }} />
        </div>
      </div>
      {children ?? <TableSkeleton />}
    </>
  );
}
