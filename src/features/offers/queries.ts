import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type OfferCreate = components["schemas"]["OfferCreate"];

const OFFERS_PAGE_SIZE = 20;
/** The waiting list shown when offering: the API's most (one page). */
const WAITING_LIMIT = 100;

export const offerKeys = {
  all: ["offers"] as const,
  route: (routeId: string) => ["offers", "route", routeId] as const,
};

/** A route's offers (`offers_list`), newest first, page by page ("Show more"). */
export function useRouteOffers(routeId: string) {
  return useInfiniteQuery({
    queryKey: offerKeys.route(routeId),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/routes/{route_id}/offers", {
          params: {
            path: { route_id: routeId },
            query: { limit: OFFERS_PAGE_SIZE, cursor: pageParam ?? undefined },
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    // An open offer turns `expired` once its 48 hours pass: fresh each time it's shown.
    staleTime: 0,
  });
}

/**
 * The open requests waiting for a route (`route_requests_list`: asked for it or matched to it),
 * oldest first: who an offer goes to. Under "route-requests", so a request's change refetches it.
 */
export function useWaitingRequests(routeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["route-requests", "waiting", routeId] as const,
    queryFn: () =>
      unwrap(
        api.GET("/v1/route-requests", {
          params: {
            query: { route_id: routeId, open: true, limit: WAITING_LIMIT },
          },
        }),
      ),
    enabled,
    staleTime: 0,
  });
}

/**
 * After an offer changes: the route's offers, the route (seats it holds), route requests
 * (fulfilled on acceptance, which demand counts) and riders (one may be made).
 */
function refetchAfterOffer(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all(
    [
      offerKeys.all,
      ["routes"],
      ["route-requests"],
      ["riders"],
      ["companies"],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/** A refusal: the offer or route moved on meanwhile (409), or the outcome is unknown. */
function refetchAfterRefusal(
  queryClient: ReturnType<typeof useQueryClient>,
  error: unknown,
) {
  const reload =
    !(error instanceof ApiError) ||
    error.kind === "network" ||
    error.status >= 500 ||
    error.status === 409 ||
    error.status === 404 ||
    (error.code?.startsWith("IDEMPOTENCY_") ?? false);
  if (reload) void refetchAfterOffer(queryClient);
}

/** `offers_create`: a route's free seat for 48 hours. One Idempotency-Key per dialog opening. */
export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeId,
      offer,
      idempotencyKey,
    }: {
      routeId: string;
      offer: OfferCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/routes/{route_id}/offers", {
          params: {
            path: { route_id: routeId },
            header: { "Idempotency-Key": idempotencyKey },
          },
          body: offer,
        }),
      ),
    onSuccess: () => refetchAfterOffer(queryClient),
    onError: (error) => refetchAfterRefusal(queryClient, error),
  });
}

/** `offers_accept`: the person said yes on the phone; the seat becomes theirs. */
export function useAcceptOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      offerId,
      idempotencyKey,
    }: {
      offerId: string;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/offers/{offer_id}/accept", {
          params: {
            path: { offer_id: offerId },
            header: { "Idempotency-Key": idempotencyKey },
          },
        }),
      ),
    onSuccess: () => refetchAfterOffer(queryClient),
    onError: (error) => refetchAfterRefusal(queryClient, error),
  });
}

/** `offers_withdraw`: the person said no (or it was a mistake); the seat is free again. */
export function useWithdrawOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) =>
      unwrap(
        api.POST("/v1/offers/{offer_id}/withdraw", {
          params: { path: { offer_id: offerId } },
        }),
      ),
    onSuccess: () => refetchAfterOffer(queryClient),
    onError: (error) => refetchAfterRefusal(queryClient, error),
  });
}
