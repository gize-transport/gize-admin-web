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
  it("announces the title and friendly message, and shows the request ID for support", () => {
    renderWithProviders(
      <ProblemAlert message="This route is full." requestId="req_01HZX4K2Q9" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(t.title);
    expect(alert).toHaveTextContent("This route is full.");
    expect(screen.getByText("req_01HZX4K2Q9")).toBeVisible();
    expect(screen.getByText(t.reference)).toBeVisible();
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
    expect(visibleCountdown()).toHaveTextContent("try again in 2 seconds");
    expect(retry).toHaveAttribute("aria-disabled", "true");
    act(() => retry.click());
    expect(onRetry).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(visibleCountdown()).toHaveTextContent("try again in 1 second.");

    act(() => vi.advanceTimersByTime(1000));
    expect(visibleCountdown()).toHaveTextContent(t.rateLimitOver);
    expect(retry).not.toHaveAttribute("aria-disabled");
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("ends the wait on time when the last tick comes a moment early", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    renderWithProviders(
      <ProblemAlert
        message="Too many requests."
        retryAfterSeconds={1}
        onRetry={onRetry}
      />,
    );
    // Timers can fire a few milliseconds before the clock reaches their time (CI runners, other
    // tabs): put the clock that far behind.
    vi.setSystemTime(Date.now() - 5);

    act(() => vi.advanceTimersByTime(1000));

    expect(visibleCountdown()).toHaveTextContent(t.rateLimitOver);
    const retry = screen.getByRole("button", { name: t.retry });
    expect(retry).not.toHaveAttribute("aria-disabled");
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("tells screen readers the wait once and when it is over – not every second", () => {
    vi.useFakeTimers();
    renderWithProviders(
      <ProblemAlert
        message="Too many requests."
        requestId="req_1"
        retryAfterSeconds={3}
      />,
    );

    const status = screen
      .getAllByRole("status")
      .find((el) => el.textContent?.includes("try again in"))!;
    expect(status).toHaveTextContent("try again in 3 seconds");
    expect(screen.getByRole("alert")).not.toHaveTextContent("try again in");

    act(() => vi.advanceTimersByTime(1000));
    expect(status).toHaveTextContent("try again in 3 seconds");

    act(() => vi.advanceTimersByTime(2000));
    expect(status).toHaveTextContent(t.rateLimitOver);
  });

  it("restarts the countdown when a new 429 arrives while the alert stays on screen", () => {
    vi.useFakeTimers();
    const { rerender } = renderWithProviders(
      <ProblemAlert
        message="Too many requests."
        requestId="req_1"
        retryAfterSeconds={1}
      />,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(visibleCountdown()).toHaveTextContent(t.rateLimitOver);

    rerender(
      <ProblemAlert
        message="Too many requests."
        requestId="req_2"
        retryAfterSeconds={60}
      />,
    );

    expect(visibleCountdown()).toHaveTextContent("try again in 60 seconds");
    act(() => vi.advanceTimersByTime(1000));
    expect(visibleCountdown()).toHaveTextContent("try again in 59 seconds");
  });
});

function visibleCountdown() {
  const countdown = document.querySelector("p[aria-hidden]");
  expect(countdown).not.toBeNull();
  return countdown as HTMLElement;
}
