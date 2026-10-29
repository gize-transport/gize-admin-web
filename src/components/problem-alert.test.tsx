import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { ProblemAlert } from "./problem-alert";

const t = messages.ProblemAlert;

afterEach(() => {
  vi.useRealTimers();
});

describe("ProblemAlert", () => {
  it("announces the friendly message and shows the request ID for support", () => {
    renderWithProviders(
      <ProblemAlert message="This route is full." requestId="req_01HZX4K2Q9" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(t.title);
    expect(alert).toHaveTextContent("This route is full.");
    expect(alert).toHaveTextContent(`${t.reference} req_01HZX4K2Q9`);
  });

  it("copies the request ID and confirms it", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProblemAlert message="This route is full." requestId="req_01HZX4K2Q9" />,
    );

    await user.click(screen.getByRole("button", { name: t.copy }));

    expect(await navigator.clipboard.readText()).toBe("req_01HZX4K2Q9");
    expect(screen.getByRole("status")).toHaveTextContent(t.copied);
  });

  it("tells the user to copy by hand when the clipboard is unavailable", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProblemAlert message="This route is full." requestId="req_01HZX4K2Q9" />,
    );
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    await user.click(screen.getByRole("button", { name: t.copy }));

    expect(screen.getByRole("status")).toHaveTextContent(t.copyFailed);
  });

  it("leaves out the reference line when there is no request ID", () => {
    renderWithProviders(<ProblemAlert message="You're offline." />);

    expect(screen.queryByText(t.reference)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.copy }),
    ).not.toBeInTheDocument();
  });

  it("offers a retry when the caller can retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <ProblemAlert
        message="Server error."
        requestId="req_1"
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole("button", { name: t.retry }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("on 429 counts down Retry-After and only then allows a retry", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    renderWithProviders(
      <ProblemAlert
        message="Too many requests."
        requestId="req_1"
        retryAfterSeconds={2}
        onRetry={onRetry}
      />,
    );

    const retry = screen.getByRole("button", { name: t.retry });
    expect(screen.getByText(/try again in 2 seconds/)).toBeInTheDocument();
    expect(retry).toHaveAttribute("aria-disabled", "true");
    act(() => retry.click());
    expect(onRetry).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/try again in 1 second\./)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(t.rateLimitOver)).toBeInTheDocument();
    expect(retry).not.toHaveAttribute("aria-disabled");
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
