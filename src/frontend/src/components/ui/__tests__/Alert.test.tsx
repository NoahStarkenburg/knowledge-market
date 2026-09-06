import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "../Alert";

describe("Alert", () => {
  it("renders children", () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByText("Something happened")).toBeInTheDocument();
  });

  it("defaults to info type with cobalt classes", () => {
    const { container } = render(<Alert>Info message</Alert>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("border-cobalt");
    expect(div.className).toContain("text-cobalt-deep");
  });

  it("applies success type classes", () => {
    const { container } = render(<Alert type="success">Success</Alert>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("border-[#1f7a3d]");
    expect(div.className).toContain("text-[#1b5e34]");
  });

  it("applies warning type classes", () => {
    const { container } = render(<Alert type="warning">Warning</Alert>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("border-[#9a6a00]");
    expect(div.className).toContain("text-[#7a5400]");
  });

  it("applies error type classes", () => {
    const { container } = render(<Alert type="error">Error</Alert>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain("border-danger");
    expect(div.className).toContain("text-danger");
  });
});
