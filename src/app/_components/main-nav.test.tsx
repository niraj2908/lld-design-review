// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ current: "/problems" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { MainNav } = await import("./main-nav");

afterEach(cleanup);

describe("the main navigation", () => {
  it("marks the section the learner is in", () => {
    pathname.current = "/attempts/att_1/review";
    render(<MainNav />);

    expect(
      screen.getByRole("link", { name: /My attempts/u }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: /Problems/u }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marks nothing on a page outside both sections", () => {
    pathname.current = "/";
    render(<MainNav />);

    for (const name of [/Problems/u, /My attempts/u]) {
      expect(
        screen.getByRole("link", { name }).getAttribute("aria-current"),
      ).toBeNull();
    }
  });
});
