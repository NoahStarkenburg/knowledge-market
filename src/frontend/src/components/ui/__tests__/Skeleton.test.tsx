import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  it("renders a div with animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.classList.contains("animate-pulse")).toBe(true);
  });

  it("renders with the default paper-dim background", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-paper-dim");
    expect(el.className).toContain("animate-pulse");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="h-10 w-40" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-40");
  });
});
