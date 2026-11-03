"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AreaPicker } from "@/components/pickers/area-picker";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { refetchRoute, useSetRouteAreas } from "./queries";

type AreaRef = components["schemas"]["AreaRef"];
type RouteRead = components["schemas"]["RouteRead"];

/** The contract's limit (RouteAreasSet.area_ids). */
const MAX_AREAS = 20;

type Action = "up" | "down" | "remove";
/** Where focus goes once the list has re-rendered. */
type FocusTarget = { id: string; action: Action } | "picker" | null;

type RouteAreasDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: RouteRead;
};

/**
 * Edit the areas a route serves (GZW-023): an ordered list between its origin and destination,
 * added with the area picker, moved with Move up / Move down and removed with Remove – all
 * buttons, so the keyboard does everything (design-system.md: no drag-only). The whole list is
 * saved at once. Mount it with a new `key` each time it opens.
 */
export function RouteAreasDialog({
  open,
  onOpenChange,
  route: routeProp,
}: RouteAreasDialogProps) {
  const t = useTranslations("Routes");
  const tCommon = useTranslations("Common");
  const { message } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const setAreas = useSetRouteAreas();
  // The route as the dialog opened with it: "no change" is worked out against this.
  const [route] = useState(routeProp);
  const [list, setList] = useState<AreaRef[]>(route.served_areas);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The status text; `count` changes it even when the same words come again (a repeat must be
  // announced too).
  const [announcement, setAnnouncementState] = useState({ text: "", count: 0 });
  const setAnnouncement = (text: string) =>
    setAnnouncementState((previous) => ({ text, count: previous.count + 1 }));
  // The API refused the list: shown under it (like a field error) and focused.
  const [listError, setListError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // The route was deleted or changed meanwhile (a 404, or the API refused the list): it reloads
  // once the dialog closes. Kept when the error is cleared by an edit.
  const [routeStale, setRouteStale] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const focusTarget = useRef<FocusTarget>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pickerRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = setAreas.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  const origin = route.corridor.origin_area;
  const destination = route.corridor.destination_area;
  const ends = { origin: origin.name, destination: destination.name };

  // A move or removal re-renders the list: then put focus where the person is working.
  useEffect(() => {
    const target = focusTarget.current;
    if (target === null) return;
    focusTarget.current = null;
    if (target === "picker") pickerRef.current?.focus();
    else buttons.current.get(`${target.id}-${target.action}`)?.focus();
  }, [list]);

  /** An edit makes an earlier refusal of the list out of date (not a 429's wait). */
  function edited() {
    setRefusal(null);
    setListError(null);
    if (!waiting) setProblem(null);
  }

  function add(area: AreaRef | null) {
    if (!area) return;
    edited();
    const refuse = (text: string) => {
      setRefusal(text);
      setAnnouncement(text);
    };
    if (area.id === origin.id) {
      return refuse(t("areaIsOrigin", { name: area.name }));
    }
    if (area.id === destination.id) {
      return refuse(t("areaIsDestination", { name: area.name }));
    }
    if (list.some((listed) => listed.id === area.id)) {
      return refuse(t("areaAlreadyListed", { name: area.name }));
    }
    const next = [...list, area];
    setList(next);
    const added = t("areaAdded", {
      name: area.name,
      position: next.length,
      count: next.length,
    });
    // The list is full now: say so with the addition.
    setAnnouncement(
      next.length >= MAX_AREAS ? `${added} ${t("areasFull")}` : added,
    );
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    const area = list[index];
    if (!area || to < 0 || to >= list.length) return;
    const next = [...list];
    next.splice(index, 1);
    next.splice(to, 0, area);
    setList(next);
    edited();
    setAnnouncement(
      t("areaMoved", { name: area.name, position: to + 1, count: next.length }),
    );
    focusTarget.current = { id: area.id, action: by === -1 ? "up" : "down" };
  }

  function remove(index: number) {
    const area = list[index];
    if (!area) return;
    const next = list.filter((_, at) => at !== index);
    setList(next);
    edited();
    setAnnouncement(t("areaRemoved", { name: area.name }));
    // The next area's Remove, else the one before, else the picker.
    const neighbour = next[index] ?? next[index - 1];
    focusTarget.current = neighbour
      ? { id: neighbour.id, action: "remove" }
      : "picker";
  }

  async function save() {
    setProblem(null);
    setListError(null);
    const ids = list.map((area) => area.id);
    const unchanged =
      ids.length === route.served_areas.length &&
      ids.every((id, index) => id === route.served_areas[index]?.id);
    try {
      if (!unchanged) {
        const saved = await setAreas.mutateAsync({
          id: route.id,
          areaIds: ids,
        });
        showSuccessToast(t("areasSaved", { code: saved.code }));
      } else if (routeStale) {
        refetchRoute(queryClient, route.id);
      }
      onOpenChange(false);
    } catch (error) {
      setProblem(error);
      if (stale(error)) setRouteStale(true);
      const onList =
        error instanceof ApiError &&
        error.fieldErrors.find((fieldError) =>
          fieldError.path.startsWith("area_ids"),
        );
      if (onList) {
        // Like a field error: under the list, linked to it, and focused.
        setListError(
          onList.reason === "too_long" ? t("areasTooMany") : t("areasRefused"),
        );
        listRef.current?.focus();
      }
    }
  }

  /**
   * Deleted meanwhile (404), or refused because the route changed meanwhile (a 422 on the list,
   * e.g. a new corridor): the route reloads once the dialog closes, so it opens as it is now.
   */
  function stale(error: unknown) {
    return (
      error instanceof ApiError &&
      (error.status === 404 ||
        error.fieldErrors.some((fieldError) =>
          fieldError.path.startsWith("area_ids"),
        ))
    );
  }

  const full = list.length >= MAX_AREAS;
  const register =
    (id: string, action: Action) => (element: HTMLButtonElement | null) => {
      const key = `${id}-${action}`;
      if (element) buttons.current.set(key, element);
      else buttons.current.delete(key);
    };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (!next && routeStale) refetchRoute(queryClient, route.id);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-lg"
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("areasTitle", { code: route.code })}</DialogTitle>
          <DialogDescription>{t("areasHint", ends)}</DialogDescription>
        </div>

        {problem !== null && listError === null && (
          <ProblemAlert
            message={message(problem)}
            requestId={problem instanceof ApiError ? problem.requestId : null}
            retryAfterSeconds={
              problem instanceof ApiError ? problem.retryAfterSeconds : null
            }
          />
        )}

        <div className="grid gap-2">
          <p className="text-table font-semibold text-navy">{origin.name}</p>
          {list.length === 0 ? (
            <p className="text-body text-muted">{t("areasEmpty")}</p>
          ) : null}
          <ol
            ref={listRef}
            tabIndex={-1}
            aria-label={t("areasListLabel", ends)}
            aria-describedby={listError ? "route-areas-error" : undefined}
            className="grid gap-1 rounded-lg outline-none empty:hidden focus-visible:ring-2 focus-visible:ring-royal"
          >
            {list.map((area, index) => (
              <li
                key={area.id}
                data-area-name={area.name}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pr-1 pl-3"
              >
                <span className="w-6 text-meta text-muted" aria-hidden>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-body text-ink">
                  {area.name}
                </span>
                <Button
                  ref={register(area.id, "up")}
                  variant="ghost"
                  size="sm"
                  className="size-9 px-0"
                  aria-disabled={index === 0 || undefined}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon aria-hidden />
                  <span className="sr-only">
                    {t("moveUp", { name: area.name })}
                  </span>
                </Button>
                <Button
                  ref={register(area.id, "down")}
                  variant="ghost"
                  size="sm"
                  className="size-9 px-0"
                  aria-disabled={index === list.length - 1 || undefined}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon aria-hidden />
                  <span className="sr-only">
                    {t("moveDown", { name: area.name })}
                  </span>
                </Button>
                <Button
                  ref={register(area.id, "remove")}
                  variant="ghost"
                  size="sm"
                  className="size-9 px-0 text-danger hover:bg-danger-soft"
                  onClick={() => remove(index)}
                >
                  <XIcon aria-hidden />
                  <span className="sr-only">
                    {t("removeArea", { name: area.name })}
                  </span>
                </Button>
              </li>
            ))}
          </ol>
          <p className="text-table font-semibold text-navy">
            {destination.name}
          </p>
          {listError && (
            <div id="route-areas-error" className="grid gap-0.5">
              <p className="text-table text-danger">{listError}</p>
              {problem instanceof ApiError && problem.requestId && (
                <p className="text-meta text-muted">
                  {t("reference", { id: problem.requestId })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="route-add-area">{t("addAreaLabel")}</Label>
          <AreaPicker
            id="route-add-area"
            ref={pickerRef}
            value={null}
            onChange={add}
            // Full: stays in place (it may hold focus), says why, doesn't open.
            disabled={full}
            invalid={refusal !== null}
            aria-describedby={
              full
                ? "route-add-area-full"
                : refusal
                  ? "route-add-area-refusal"
                  : undefined
            }
          />
          {full && (
            <p id="route-add-area-full" className="text-table text-muted">
              {t("areasFull")}
            </p>
          )}
          {refusal && !full && (
            <p id="route-add-area-refusal" className="text-table text-danger">
              {refusal}
            </p>
          )}
        </div>

        {/* A visual summary of the list above, which screen readers already have. */}
        <div aria-hidden className="grid gap-1 rounded-lg bg-canvas px-3 py-2">
          <p className="text-meta font-semibold text-muted">
            {t("areasPreview")}
          </p>
          <p className="text-table text-ink">
            {[origin, ...list, destination].map((area, index) => (
              <span key={`${area.id}-${index}`}>
                {index > 0 && (
                  <span aria-hidden="true" className="mx-1.5 text-muted">
                    →
                  </span>
                )}
                {area.name}
              </span>
            ))}
          </p>
        </div>

        {/* What a move, an addition or a removal did, for screen readers. */}
        <p role="status" className="sr-only">
          {announcement.text}
          {/* An invisible change, so the same words are announced again. */}
          {announcement.count % 2 === 1 ? "\u200b" : ""}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary" aria-disabled={pending || undefined}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button
            pending={pending}
            aria-disabled={waiting || undefined}
            onClick={() => void save()}
          >
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
