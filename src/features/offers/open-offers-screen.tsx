"use client";

import { useQueryClient } from "@tanstack/react-query";
import { TicketIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  CellWithPicture,
  createDataTableColumnHelper,
  DataTable,
  useListParams,
} from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/no-permission";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useTimestampFormat } from "@/lib/time";
import { offerKeys, useOpenOffers } from "./queries";
import {
  AcceptOfferDialog,
  useMonthName,
  WithdrawOfferDialog,
} from "./seat-offers";

type OfferRead = components["schemas"]["OfferRead"];

const col = createDataTableColumnHelper<OfferRead>();

const linkClass = "font-semibold text-royal underline-offset-4 hover:underline";

/** The offer a dialog answers; a new `key` per opening (one Idempotency-Key each). */
type Answer = { kind: "accept" | "withdraw"; offer: OfferRead; key: number };

/**
 * Seat offers (GZW-085): open offers on every route (`offers_list_open`, GZ-084), the one running
 * out soonest first, so staff phone each person (texts are off) and accept or withdraw for them.
 * The Overview's "Open seat offers" count opens it. A name opens the request (phone number there);
 * past offers stay on each route's Seat offers tab.
 */
export function OpenOffersScreen() {
  const t = useTranslations("OpenOffers");
  const tOffers = useTranslations("Offers");
  const { message } = useApiErrorMessages();
  const { dateTime } = useTimestampFormat();
  const month = useMonthName();
  const { cursor } = useListParams();
  const offers = useOpenOffers(cursor);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);

  // An offer leaves the list when its 48 hours pass: read it again then, so the page never offers
  // to accept one that has run out (the first on the page runs out soonest).
  const queryClient = useQueryClient();
  const nextExpiry = offers.data?.items
    .map((offer) => Date.parse(offer.expires_at))
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (nextExpiry === undefined) return;
    // Timers cap at about 24.8 days; an offer lasts 48 hours.
    const wait = Math.min(
      Math.max(nextExpiry - Date.now(), 0) + 1000,
      2 ** 31 - 1,
    );
    const timer = setTimeout(
      () =>
        void queryClient.invalidateQueries({
          queryKey: offerKeys.open(cursor),
        }),
      wait,
    );
    return () => clearTimeout(timer);
  }, [nextExpiry, queryClient, cursor]);

  const columns = useMemo(() => {
    function open(kind: Answer["kind"], offer: OfferRead) {
      setAnswer((current) => ({ kind, offer, key: (current?.key ?? 0) + 1 }));
      setAnswerOpen(true);
    }
    return col.columns([
      col.accessor("rider_name", {
        header: t("colWho"),
        cell: (info) => (
          <CellWithPicture picture={<Avatar name={info.getValue()} />}>
            <Link
              href={`/route-requests/${info.row.original.request_id}`}
              className={linkClass}
            >
              {info.getValue()}
            </Link>
          </CellWithPicture>
        ),
      }),
      col.accessor("route_code", {
        header: t("colRoute"),
        cell: (info) => (
          <Link
            href={`/routes/${info.row.original.route_id}`}
            className={`font-mono ${linkClass}`}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      col.accessor("start_date", {
        header: t("colSeatFrom"),
        cell: (info) => month(info.getValue()),
      }),
      col.accessor("expires_at", {
        header: t("colRunsOut"),
        cell: (info) => dateTime(info.getValue()),
      }),
      col.display({
        id: "answer",
        header: () => <span className="sr-only">{t("colAnswer")}</span>,
        cell: (info) => {
          const offer = info.row.original;
          return (
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => open("accept", offer)}>
                {tOffers("accept")}{" "}
                <span className="sr-only">
                  {t("forWhom", { name: offer.rider_name })}
                </span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => open("withdraw", offer)}
              >
                {tOffers("withdraw")}{" "}
                <span className="sr-only">
                  {t("forWhom", { name: offer.rider_name })}
                </span>
              </Button>
            </span>
          );
        },
      }),
    ]);
  }, [t, tOffers, dateTime, month]);

  if (isForbidden(offers.error)) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <NoPermission />
      </>
    );
  }

  function closeAnswer() {
    setAnswerOpen(false);
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <DataTable
        label={t("tableLabel")}
        columns={columns}
        data={offers.data?.items}
        getRowId={(offer) => offer.id}
        isLoading={offers.isPending}
        nextCursor={offers.data?.next_cursor ?? null}
        error={
          offers.isError ? (
            <ProblemAlert
              message={message(offers.error)}
              requestId={
                offers.error instanceof ApiError ? offers.error.requestId : null
              }
              retryAfterSeconds={
                offers.error instanceof ApiError
                  ? offers.error.retryAfterSeconds
                  : null
              }
              onRetry={() => void offers.refetch()}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<TicketIcon aria-hidden />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />

      {answer?.kind === "accept" && (
        <AcceptOfferDialog
          key={answer.key}
          offer={answer.offer}
          open={answerOpen}
          onClose={closeAnswer}
        />
      )}
      {answer?.kind === "withdraw" && (
        <WithdrawOfferDialog
          key={answer.key}
          offer={answer.offer}
          open={answerOpen}
          onClose={closeAnswer}
        />
      )}
    </>
  );
}
