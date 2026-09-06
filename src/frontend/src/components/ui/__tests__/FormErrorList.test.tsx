import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormErrorList } from "../FormErrorList";
import type { ApiError } from "../../../api/types";

describe("FormErrorList", () => {
  it("renders nothing when no error is provided", () => {
    const { container } = render(<FormErrorList />);
    expect(container.firstElementChild).toBeNull();
  });

  it("renders the detail message", () => {
    const error: ApiError = { status: 400, detail: "Invalid input" };
    render(<FormErrorList error={error} />);
    expect(screen.getByText("Invalid input")).toBeInTheDocument();
  });

  it("renders the message when it differs from detail", () => {
    const error: ApiError = {
      status: 400,
      detail: "Detail text",
      message: "Message text",
    };
    render(<FormErrorList error={error} />);
    expect(screen.getByText("Detail text")).toBeInTheDocument();
    expect(screen.getByText("Message text")).toBeInTheDocument();
  });

  it("does not duplicate message when it equals detail", () => {
    const error: ApiError = {
      status: 400,
      detail: "Same text",
      message: "Same text",
    };
    render(<FormErrorList error={error} />);
    const items = screen.getAllByText("Same text");
    expect(items).toHaveLength(1);
  });

  it("renders field errors from the errors record", () => {
    const error: ApiError = {
      status: 422,
      errors: {
        email: ["Email is required", "Email is invalid"],
        password: ["Password too short"],
      },
    };
    render(<FormErrorList error={error} />);
    expect(screen.getByText("email: Email is required")).toBeInTheDocument();
    expect(screen.getByText("email: Email is invalid")).toBeInTheDocument();
    expect(screen.getByText("password: Password too short")).toBeInTheDocument();
  });

  it("renders nothing when error has no messages, detail, or errors", () => {
    const error: ApiError = { status: 500 };
    const { container } = render(<FormErrorList error={error} />);
    expect(container.firstElementChild).toBeNull();
  });
});
