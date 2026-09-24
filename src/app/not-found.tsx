import Link from "next/link";
import { FileQuestion, LayoutList } from "lucide-react";

export default function NotFound() {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileQuestion size={17} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h3>That page does not exist</h3>
      <p>
        The problem or attempt you asked for is not here. It may have been a stale
        link, or an attempt that belongs to someone else.
      </p>
      <Link href="/problems" className="btn btn-primary">
        <LayoutList aria-hidden="true" />
        Browse problems
      </Link>
    </div>
  );
}
