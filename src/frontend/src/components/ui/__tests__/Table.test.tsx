import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table } from "../Table";

describe("Table", () => {
  it("renders as a table element", () => {
    render(<Table><tbody><tr><td>Cell</td></tr></tbody></Table>);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Row content</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByText("Row content")).toBeInTheDocument();
  });
});
