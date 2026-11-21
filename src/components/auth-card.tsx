import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

/**
 * The card the signed-out pages share (sign-in, forgot password, set password): the logo, the
 * page's name as its h1 and a short description, then the page's own content. It sits on the
 * navy "night routes" background (GZW-082).
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
  const t = useTranslations("SignIn");
  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-navy px-4 py-12">
      <RoutesBackdrop />
      <div className="grid w-full max-w-sm gap-6 rounded-xl bg-surface p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="grid justify-items-start gap-4">
          {/* 128 px file shown at 48 px, served as is: too small to need an image service. */}
          <Image
            src="/brand/logo-mark.png"
            alt={t("logoAlt")}
            width={48}
            height={48}
            unoptimized
            priority
          />
          <div className="grid gap-1">
            <h1 className="font-display text-title font-semibold text-navy">
              {title}
            </h1>
            <p className="text-table text-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Stops on the routes: the sun ones stand out, the white ones stay quiet. */
const STOPS = [
  { x: 520, y: 290, sun: true },
  { x: 1080, y: 190, sun: false },
  { x: 560, y: 720, sun: false },
  { x: 1160, y: 640, sun: true },
  { x: 262, y: 540, sun: true },
  { x: 1210, y: 520, sun: false },
  { x: 196, y: 352, sun: false },
  { x: 330, y: 500, sun: false },
] as const;

/**
 * Faint bus routes with their stops across the navy, a soft light behind the card. Drawn in code
 * with the brand tokens (no image to load) and for sight only. It covers any screen shape,
 * cropping the edges.
 */
function RoutesBackdrop() {
  const glow = `${useId()}-glow`;
  return (
    <svg
      aria-hidden
      data-testid="routes-backdrop"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      viewBox="0 0 1440 900"
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
      <ellipse cx="720" cy="450" rx="620" ry="420" fill={`url(#${glow})`} />
      <g strokeLinecap="round" strokeWidth="3">
        <path
          d="M-40 210 C 180 150 300 330 520 290 S 860 120 1080 190 S 1380 330 1500 260"
          className="stroke-blue/45"
        />
        <path
          d="M-40 700 C 160 640 330 780 560 720 S 930 560 1160 640 S 1400 760 1500 700"
          className="stroke-sky/35"
          strokeDasharray="10 12"
        />
        <path
          d="M240 -40 C 300 160 170 360 260 540 S 380 820 330 960"
          className="stroke-blue/30"
        />
        <path
          d="M1180 -40 C 1120 170 1270 330 1210 520 S 1060 780 1130 960"
          className="stroke-sky/30"
          strokeDasharray="10 12"
        />
        <path
          d="M-40 470 C 120 430 200 520 330 500"
          className="stroke-white/12"
        />
        <path
          d="M1110 420 C 1240 380 1340 470 1500 440"
          className="stroke-white/12"
        />
      </g>
      {STOPS.map(({ x, y, sun }) => (
        <g key={`${x}-${y}`} className={sun ? "fill-sun" : "fill-white"}>
          <circle cx={x} cy={y} r="14" fillOpacity="0.12" />
          <circle cx={x} cy={y} r="6" fillOpacity={sun ? 0.9 : 0.55} />
        </g>
      ))}
    </svg>
  );
}
