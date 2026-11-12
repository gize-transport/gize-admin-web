import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";

/** How often the list reloads while texts are going out. */
const WATCH_EVERY_MS = 3000;

export const launchKeys = {
  route: (routeId: string) => ["launch-messages", routeId] as const,
};

/**
 * The texts a route's latest launch sent its riders (`routes_launch_messages`). The API sends them
 * in the background after the launch (or a resend) answers, so the list reloads every few seconds
 * while one is sending, and until `watchUntil` (just after a launch or resend) while any is still
 * to go. Never forever: a restart midway leaves texts "not sent yet" until staff send them again.
 */
export function useLaunchMessages(
  routeId: string,
  { enabled, watchUntil }: { enabled: boolean; watchUntil: number },
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
      if (!data) return false;
      if (data.sending > 0) return WATCH_EVERY_MS;
      return data.failed + data.pending > 0 && Date.now() < watchUntil
        ? WATCH_EVERY_MS
        : false;
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
