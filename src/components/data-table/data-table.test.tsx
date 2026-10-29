import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  DataTable,
  RowAction,
  createDataTableColumnHelper,
} from "./data-table";

// vi.hoisted runs before imports, so the helper is imported inside it.
const { nav, mockNavigation } = await vi.hoisted(async () => {
  const helpers = await import("../../../tests/utils/navigation");
  return { nav: helpers.createNavigationState(), ...helpers };
});
vi.mock("next/navigation", () => mockNavigation(nav));

const t = messages.DataTable;

type Route = { id: string; code: string; driver: string };
const routes: Route[] = [
  { id: "r3", code: "R-03", driver: "Tesfaye M." },
  { id: "r5", code: "R-05", driver: "Mulu A." },
];

const onSelect = vi.fn<(id: string) => void>();
const col = createDataTableColumnHelper<Route>();
const columns = col.columns([
  col.accessor("code", {
    header: "Route",
    cell: (info) => (
      <RowAction onSelect={() => onSelect(info.row.original.id)}>
        {info.getValue()}
      </RowAction>
    ),
  }),
  col.accessor("driver", { header: "Driver" }),
  col.display({
    id: "actions",
    header: "Actions",
    cell: () => <button type="button">Call driver</button>,
  }),
]);

function renderTable(
  props: Partial<Parameters<typeof DataTable<Route>>[0]> = {},
) {
  return renderWithProviders(
    <DataTable
      label="Routes"
      columns={columns}
      data={routes}
      getRowId={(route) => route.id}
      emptyState={<p>No routes yet</p>}
      {...props}
    />,
  );
}

beforeEach(() => {
  nav.pathname = "/routes";
  nav.search = "";
  nav.push.mockClear();
  onSelect.mockClear();
});

describe("DataTable", () => {
  it("renders a captioned table with column headers and one row per item", () => {
    renderTable();

    const table = screen.getByRole("table", { name: "Routes" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Route", "Driver", "Actions"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Tesfaye M.")).toBeInTheDocument();
  });

  it("puts the table in a labelled, keyboard-focusable scroll region (for narrow screens)", () => {
    renderTable();

    const region = screen.getByRole("region", { name: "Routes" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toContainElement(screen.getByRole("table"));
  });

  it("shows skeleton rows and tells screen readers it is loading", () => {
    renderTable({ data: undefined, isLoading: true });

    const table = screen.getByRole("table", { name: "Routes" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(t.loading);
    expect(within(table).queryByText("Tesfaye M.")).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("shows the empty state instead of an empty table", () => {
    renderTable({ data: [] });

    expect(screen.getByText("No routes yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error instead of the table", () => {
    renderTable({ error: <div role="alert">Server error</div> });

    expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("opens a row from its row action with the keyboard", async () => {
    const user = userEvent.setup();
    renderTable();

    screen.getByRole("button", { name: "R-05" }).focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("r5");
  });

  it("opens a row when any plain cell is clicked", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText("Mulu A."));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("r5");
  });

  it("does not open the row when another control in it is used", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(
      screen.getAllByRole("button", { name: "Call driver" })[0]!,
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not open the row when the user is selecting text", async () => {
    const user = userEvent.setup();
    renderTable();
    const cell = screen.getByText("Mulu A.");

    await user.pointer([
      { keys: "[MouseLeft>]", target: cell, offset: 0 },
      { target: cell, offset: 4 },
      { keys: "[/MouseLeft]", target: cell, offset: 4 },
    ]);

    expect(window.getSelection()?.toString()).toBe("Mulu");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the selected row", () => {
    renderTable({ selectedRowId: "r5" });

    expect(screen.getByText("Mulu A.").closest("tr")).toHaveAttribute(
      "data-state",
      "selected",
    );
    expect(screen.getByText("Tesfaye M.").closest("tr")).not.toHaveAttribute(
      "data-state",
    );
  });
});

describe("DataTable cursor pagination", () => {
  it("links to the next page with the cursor in the URL, keeping filters", () => {
    nav.search = "type=student";
    renderTable({ nextCursor: "c2" });

    const pages = screen.getByRole("navigation", { name: t.pagination });
    expect(
      within(pages).getByRole("link", { name: t.nextPage }),
    ).toHaveAttribute("href", "/routes?type=student&cursor=c2");
    expect(
      within(pages).queryByRole("link", { name: t.firstPage }),
    ).not.toBeInTheDocument();
  });

  it("offers the first page once past page 1, keeping filters", () => {
    nav.search = "type=student&cursor=c2";
    renderTable({ nextCursor: "c3" });

    expect(screen.getByRole("link", { name: t.firstPage })).toHaveAttribute(
      "href",
      "/routes?type=student",
    );
    expect(screen.getByRole("link", { name: t.nextPage })).toHaveAttribute(
      "href",
      "/routes?type=student&cursor=c3",
    );
  });

  it("has no next link on the last page", () => {
    nav.search = "cursor=c3";
    renderTable({ nextCursor: null });

    expect(
      screen.queryByRole("link", { name: t.nextPage }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.firstPage })).toHaveAttribute(
      "href",
      "/routes",
    );
  });

  it("shows no pagination when everything fits on one page", () => {
    renderTable({ nextCursor: null });

    expect(
      screen.queryByRole("navigation", { name: t.pagination }),
    ).not.toBeInTheDocument();
  });
});
