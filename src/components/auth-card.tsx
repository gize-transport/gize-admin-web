import { InboxIcon, RouteIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The layout the signed-out pages share (sign-in, forgot password, set password, email link): a
 * navy brand panel with the routes and the tagline beside the form – a short band above it below
 * 1024 px (GZW-083) – then the page's name as its h1, a short description and its own content.
 * The panel moves a little (GZW-084): routes draw in, minibuses drive along them, the text rises in.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid flex-1 grid-rows-[auto_1fr] bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      <BrandPanel />
      <div className="flex items-start justify-center px-4 py-10 sm:px-8 sm:py-14 lg:items-center lg:py-12">
        <div className="grid w-full max-w-sm gap-6">
          <div className="grid gap-1">
            <h1 className="font-display text-title font-semibold text-navy">
              {title}
            </h1>
            <p className="text-table text-muted">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

/** What the portal is for, under the tagline (wide screens only), rising in one after another. */
const POINTS = [
  {
    key: "pointRoutes",
    icon: RouteIcon,
    delay: "motion-safe:[animation-delay:450ms]",
  },
  {
    key: "pointRequests",
    icon: InboxIcon,
    delay: "motion-safe:[animation-delay:560ms]",
  },
  {
    key: "pointPeople",
    icon: UsersIcon,
    delay: "motion-safe:[animation-delay:670ms]",
  },
] as const;

/**
 * The logo with "Gize ADMIN" (as in the sidebar), and in the middle of the panel the tagline, a
 * summary and what the portal is for, over the routes. The band below 1024 px keeps the tagline.
 */
function BrandPanel() {
  const t = useTranslations("SignIn");
  const tShell = useTranslations("Shell");
  return (
    <div className="relative isolate flex flex-col gap-5 overflow-hidden bg-navy px-6 py-6 sm:px-8 lg:gap-12 lg:p-12">
      <RoutesBackdrop />
      <p className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white">
          {/* 128 px file shown at 28 px, served as is: too small to need an image service. */}
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={28}
            height={28}
            unoptimized
            priority
          />
        </span>
        <span className="font-display text-section font-bold text-white">
          {tShell("brand")}
        </span>{" "}
        <span className="text-meta font-semibold tracking-wider text-sun uppercase">
          {tShell("brandTag")}
        </span>
      </p>
      {/*
        Centred in the panel (the spacer below matches the name's height). A soft navy shade
        behind the text keeps it readable over the routes and the passing minibuses: a gradient,
        not a blur filter, so nothing costly is redrawn while they move under it.
      */}
      <div className="relative isolate grid max-w-md gap-5 lg:my-auto lg:before:absolute lg:before:-inset-x-16 lg:before:-inset-y-14 lg:before:-z-10 lg:before:bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-navy)_95%,transparent)_62%,transparent)]">
        {/* On short screens (a landscape phone, high zoom) the band keeps to the name. */}
        <p className="font-display text-section font-semibold text-balance text-white max-lg:[@media(max-height:480px)]:hidden motion-safe:animate-rise motion-safe:[animation-delay:150ms] lg:text-[2.5rem] lg:leading-[1.15]">
          {t("tagline")}
        </p>
        {/* Left out on short wide screens (under 720 px high), so the panel never scrolls. */}
        <p className="hidden text-body text-white/80 motion-safe:animate-rise motion-safe:[animation-delay:300ms] lg:block lg:[@media(max-height:720px)]:hidden">
          {t("summary")}
        </p>
        <ul className="hidden gap-3 lg:grid">
          {POINTS.map(({ key, icon: Icon, delay }) => (
            <li
              key={key}
              className={cn(
                "flex items-start gap-3 text-body text-white/90 motion-safe:animate-rise",
                delay,
              )}
            >
              <Icon
                aria-hidden
                className="mt-0.5 size-[18px] shrink-0 text-sun"
              />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="hidden h-10 lg:block" />
    </div>
  );
}

/**
 * Stops on the routes: the sun ones stand out, the white ones stay quiet. Only in the tall panel,
 * around the text in its middle and clear of the name at its top: a stop under white text would
 * break its contrast. The band below 1024 px crops a different middle at each width, so it shows
 * the lines only.
 */
const STOPS = [
  { x: 420, y: 240, sun: true },
  { x: 150, y: 251, sun: false },
  { x: 590, y: 301, sun: false },
  { x: 644, y: 587, sun: true },
  { x: 519, y: 714, sun: false },
  { x: 266, y: 802, sun: true },
] as const;

/** The routes; `dashed` ones fade in, the others draw in. */
const ROUTES = [
  {
    key: "a",
    d: "M-20 180 C 140 120 260 280 420 240 S 640 120 740 170",
    className: "stroke-blue/45",
    dashed: false,
  },
  {
    key: "b",
    d: "M-20 640 C 120 590 240 720 400 670 S 560 560 740 600",
    className: "stroke-sky/35",
    dashed: true,
  },
  {
    key: "c",
    d: "M140 -20 C 90 120 180 330 200 470 S 300 760 250 920",
    className: "stroke-blue/30",
    dashed: false,
  },
  {
    key: "d",
    d: "M560 -20 C 520 180 640 330 590 500 S 470 760 530 920",
    className: "stroke-sky/30",
    dashed: true,
  },
] as const;

/**
 * Minibuses: each drives in along part of its route (the same curve, cut where a stop is) and
 * parks at that stop. All have parked within 5 s, so nothing keeps moving beside the form
 * (WCAG 2.2.2: moving content over 5 s would need a pause control).
 */
const VANS = [
  {
    key: "a",
    path: "M-20 180 C 140 120 260 280 420 240",
    seconds: 3.6,
    sun: false,
  },
  {
    key: "c",
    path: "M140 -20 C 90 120 180 330 200 470 C 215 575 263.75 685.6 266.1 801.4",
    seconds: 4.6,
    sun: false,
  },
  {
    key: "d",
    path: "M560 -20 C 536 100 569.6 202 589.5 301.1",
    seconds: 3.2,
    sun: true,
  },
  {
    key: "b",
    path: "M-20 640 C 120 590 240 720 400 670 C 524.8 631 552.3 585.9 643.7 586.9",
    seconds: 4.2,
    sun: true,
  },
] as const;

/**
 * Faint bus routes with their stops and minibuses across the navy, a soft light in the middle.
 * Drawn in code with the brand tokens (no image or video to load) and for sight only. Drawn for
 * the tall panel; the short band above the form below 1024 px shows its middle, without stops or
 * minibuses. It moves only as the page opens (all over within 5 s). With less motion asked for,
 * it is still: no minibuses, no pulse, nothing drawing in.
 */
function RoutesBackdrop() {
  const id = useId();
  const glow = `${id}-glow`;
  return (
    <svg
      aria-hidden
      data-testid="routes-backdrop"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        {/* Classes, not style attributes, so the CSP's style-src can be tightened later. */}
        <radialGradient id={glow}>
          <stop
            offset="0%"
            className="[stop-color:var(--color-royal)] [stop-opacity:0.55]"
          />
          <stop
            offset="100%"
            className="[stop-color:var(--color-royal)] [stop-opacity:0]"
          />
        </radialGradient>
      </defs>
      <ellipse cx="360" cy="450" rx="400" ry="440" fill={`url(#${glow})`} />
      <g strokeLinecap="round" strokeWidth="3">
        {ROUTES.map(({ key, d, className, dashed }) => (
          <path
            key={key}
            d={d}
            className={cn(
              className,
              dashed
                ? "motion-safe:animate-route-fade"
                : "motion-safe:animate-route-draw",
            )}
            // Drawn in: one dash as long as the path (pathLength 1), slid into view.
            {...(dashed
              ? { strokeDasharray: "10 12" }
              : { pathLength: 1, strokeDasharray: 1 })}
          />
        ))}
        <path
          d="M-20 420 C 100 390 160 470 260 448"
          className="stroke-white/12"
        />
        <path
          d="M470 400 C 570 370 650 440 740 410"
          className="stroke-white/12"
        />
      </g>
      <g data-testid="routes-stops" className="hidden lg:inline">
        {STOPS.map(({ x, y, sun }, index) => (
          <g key={`${x}-${y}`} className={sun ? "fill-sun" : "fill-white"}>
            <circle
              cx={x}
              cy={y}
              r="14"
              fillOpacity="0.12"
              className={cn(
                "origin-center [transform-box:fill-box]",
                sun && "motion-safe:animate-stop-pulse",
                index % 2 === 1 && "motion-safe:[animation-delay:0.8s]",
              )}
            />
            <circle cx={x} cy={y} r="6" fillOpacity={sun ? 0.9 : 0.55} />
          </g>
        ))}
      </g>
      <g data-testid="routes-vans" className="hidden motion-safe:lg:inline">
        {VANS.map(({ key, path, seconds, sun }) => (
          <rect
            key={key}
            x="-12"
            y="-7"
            width="24"
            height="14"
            rx="5"
            className={sun ? "fill-sun" : "fill-white"}
          >
            {/* Slowing down as it pulls in, then parked (fill="freeze"). */}
            <animateMotion
              path={path}
              dur={`${seconds}s`}
              fill="freeze"
              rotate="auto"
              calcMode="spline"
              keyTimes="0;1"
              keyPoints="0;1"
              keySplines="0.3 0.6 0.4 1"
            />
          </rect>
        ))}
      </g>
    </svg>
  );
}
