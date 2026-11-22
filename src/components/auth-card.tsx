import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

/**
 * The layout the signed-out pages share (sign-in, forgot password, set password, email link): a
 * navy brand panel with the routes and the tagline beside the form – a short band above it below
 * 1024 px (GZW-083) – then the page's name as its h1, a short description and its own content.
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

/** The logo with "Gize ADMIN" (as in the sidebar), and the tagline over the routes. */
function BrandPanel() {
  const t = useTranslations("SignIn");
  const tShell = useTranslations("Shell");
  return (
    <div className="relative isolate flex flex-col justify-between gap-5 overflow-hidden bg-navy px-6 py-6 sm:px-8 lg:gap-12 lg:p-12">
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
      {/* On short screens (a landscape phone, high zoom) the band keeps to the name. */}
      <p className="max-w-md font-display text-section font-semibold text-balance text-white max-lg:[@media(max-height:480px)]:hidden lg:text-[2.5rem] lg:leading-[1.15]">
        {t("tagline")}
      </p>
    </div>
  );
}

/**
 * Stops on the routes: the sun ones stand out, the white ones stay quiet. Only in the tall
 * panel, clear of the name at its top and the tagline at its foot (left of x 480 from y 640, on
 * screens down to 600 px high): a stop under white text would break its contrast. The band below
 * 1024 px crops a different middle at each width, so it shows the lines only.
 */
const STOPS = [
  { x: 420, y: 240, sun: true },
  { x: 150, y: 251, sun: false },
  { x: 200, y: 470, sun: true },
  { x: 601, y: 375, sun: false },
  { x: 563, y: 601, sun: false },
  { x: 642, y: 588, sun: true },
  { x: 260, y: 448, sun: false },
] as const;

/**
 * Faint bus routes with their stops across the navy, a soft light in the middle. Drawn in code
 * with the brand tokens (no image to load) and for sight only. Drawn for the tall panel; the
 * short band above the form below 1024 px shows its middle.
 */
function RoutesBackdrop() {
  const glow = `${useId()}-glow`;
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
        <path
          d="M-20 180 C 140 120 260 280 420 240 S 640 120 740 170"
          className="stroke-blue/45"
        />
        <path
          d="M-20 640 C 120 590 240 720 400 670 S 560 560 740 600"
          className="stroke-sky/35"
          strokeDasharray="10 12"
        />
        <path
          d="M140 -20 C 90 120 180 330 200 470 S 300 760 250 920"
          className="stroke-blue/30"
        />
        <path
          d="M560 -20 C 520 180 640 330 590 500 S 470 760 530 920"
          className="stroke-sky/30"
          strokeDasharray="10 12"
        />
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
        {STOPS.map(({ x, y, sun }) => (
          <g key={`${x}-${y}`} className={sun ? "fill-sun" : "fill-white"}>
            <circle cx={x} cy={y} r="14" fillOpacity="0.12" />
            <circle cx={x} cy={y} r="6" fillOpacity={sun ? 0.9 : 0.55} />
          </g>
        ))}
      </g>
    </svg>
  );
}
