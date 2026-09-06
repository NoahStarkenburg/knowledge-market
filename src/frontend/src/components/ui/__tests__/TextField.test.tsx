import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextField } from "../TextField";

describe("TextField", () => {
  it("renders the label text", () => {
    render(<TextField label="Username" />);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("renders an input element", () => {
    render(<TextField label="Email" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders helperText when provided", () => {
    render(<TextField label="Email" helperText="We will never share your email" />);
    expect(screen.getByText("We will never share your email")).toBeInTheDocument();
  });

  it("does not render helperText when absent", () => {
    const { container } = render(<TextField label="Email" />);
    const spans = container.querySelectorAll("span");
    // Only the label span should exist
    expect(spans).toHaveLength(1);
  });

  it("passes through placeholder attribute", () => {
    render(<TextField label="Name" placeholder="Enter your name" />);
    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });

  it("passes through type attribute", () => {
    render(<TextField label="Password" type="password" />);
    const input = document.querySelector("input");
    expect(input).toHaveAttribute("type", "password");
  });

  it("passes through disabled attribute", () => {
    render(<TextField label="Disabled" disabled />);
    const input = document.querySelector("input");
    expect(input).toBeDisabled();
  });
});
