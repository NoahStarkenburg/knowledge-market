import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("has default heavy ink border", () => {
    const { container } = render(<Card>Content</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("border-2");
    expect(div.className).toContain("border-ink");
  });

  it("merges custom className", () => {
    const { container } = render(<Card className="extra-class">Content</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("extra-class");
    expect(div.className).toContain("border-2");
  });

  it("respects padded=false to omit default padding", () => {
    const { container } = render(<Card padded={false}>Content</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).not.toContain("p-5");
  });
});
