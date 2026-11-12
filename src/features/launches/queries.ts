import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";

/** How often the list reloads while texts are going out. */
const WATCH_EVERY_MS = 3000;
/** After a launch or a resend, how long texts still to go are watched. */
const WATCH_MS = 60_000;

export const launchKeys = {
  route: (routeId: string) => ["launch-messages", routeId] as const,
};

/**
 * The texts a route's latest launch sent its riders (`routes_launch_messages`). The API sends them
 * in the background after the launch (or a resend) answers, so the list reloads every few seconds
 * while one is sending; for a minute after a launch here while any is not sent yet; and for a
 * minute after a resend while any is not delivered or not sent yet (the answer shows them as they
 * were). Never forever: a restart midway leaves texts "not sent yet" until staff send them again.
 * Both times are this browser's own clock. A failed read stops it (Retry starts it again), so a
 * 429's Retry-After is respected.
 */
export function useLaunchMessages(
  routeId: string,
  {
    enabled,
    launchedAt,
    resentAt,
  }: {
    enabled: boolean;
    /** When this page launched the route (0: not here), read as it polls. */
    launchedAt: RefObject<number>;
    resentAt: number;
  },
) {
  return useQuery({
    queryKey: launchKeys.route(routeId),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes/{route_id}/launch-messages", {
          params: { path: { route_id: routeId } },
        }),
      ),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || query.state.status === "error") return false;
      const now = Date.now();
      const watched =
        data.sending > 0 ||
        (data.pending > 0 && now < launchedAt.current + WATCH_MS) ||
        (data.failed + data.pending > 0 && now < resentAt + WATCH_MS);
      return watched ? WATCH_EVERY_MS : false;
    },
  });
}

/**
 * `routes_retry_launch_messages`: sends the failed and not-yet-sent texts again, after it answers
 * (202, with the texts as they were). Never one sent, sending or that may have arrived (the API
 * decides). One Idempotency-Key per confirmation dialog: a retried request starts nothing more.
 */
export function useRetryLaunchMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeId,
      idempotencyKey,
    }: {
      routeId: string;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/routes/{route_id}/launch-messages/retry", {
          params: {
            path: { route_id: routeId },
            header: { "Idempotency-Key": idempotencyKey },
          },
        }),
      ),
    onSuccess: (messages, { routeId }) => {
      queryClient.setQueryData(launchKeys.route(routeId), messages);
    },
    // Refused or no answer: what was sent may have changed meanwhile.
    onError: (error, { routeId }) => {
      if (error instanceof ApiError && error.status === 429) return;
      void queryClient.invalidateQueries({
        queryKey: launchKeys.route(routeId),
      });
    },
  });
}
