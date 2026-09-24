"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutList } from "lucide-react";

const LINKS = [
  { href: "/problems", label: "Problems", Icon: LayoutList },
  { href: "/attempts", label: "My attempts", Icon: History },
] as const;

/**
 * The only navigation in the product, so it has to say where you are as well as
 * where you can go — hence `aria-current`, which the stylesheet also renders
 * visually rather than relying on the assistive layer alone.
 */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          {...(pathname.startsWith(href) ? { "aria-current": "page" as const } : {})}
        >
          <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
