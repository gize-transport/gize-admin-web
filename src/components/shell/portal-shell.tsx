"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOpenRequestCount } from "@/features/overview/queries";
import { isForbidden } from "@/lib/api/problem";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useSignOut } from "@/lib/auth/use-sign-out";
import { cn } from "@/lib/utils";
import { AccountPanel } from "./account-panel";
import {
  isCurrentPath,
  navGroups,
  navItems,
  visibleNavItems,
  type NavGroup,
  type NavItem,
} from "./nav-items";

// Inside the navy sidebar the royal focus ring is too faint (under 3:1), so it is white there.
const onNavy = "focus-visible:outline-white";

type PortalShellProps = {
  children: ReactNode;
  /** Tests pass the full list; the app uses `navItems`. */
  items?: readonly NavItem[];
};

/**
 * The signed-in portal: navy sidebar (from 1024 px) or a top bar with a menu drawer, and the
 * page in `<main>` (design-system.md, "Layout"; Admin mockup).
 */
export function PortalShell({ children, items = navItems }: PortalShellProps) {
  const t = useTranslations("Shell");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const staff = useCurrentStaff();
  const signOut = useSignOut();

  // Signed in to Supabase but the API says not (or no longer) active staff: sign out, once.
  const forbidden = isForbidden(staff.error);
  const signedOutForbidden = useRef(false);
  useEffect(() => {
    if (!forbidden || signedOutForbidden.current) return;
    signedOutForbidden.current = true;
    void signOut("not_staff");
  }, [forbidden, signOut]);

  // The drawer is for narrow screens: widening past 1024 px closes it.
  useEffect(() => {
    const wide = window.matchMedia?.("(min-width: 1024px)");
    if (!wide) return;
    const close = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Reads the URL: on pages with an id in it, that's only known at request time. */}
      <Suspense fallback={null}>
        <CloseOnNavigation onNavigate={closeMenu} />
      </Suspense>
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold text-navy focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>

      {/* Phones and tablets: top bar with the menu. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-navy px-2 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            className={cn(
              "grid size-10 place-items-center rounded-lg text-white hover:bg-white/10",
              onNavy,
            )}
          >
            <MenuIcon aria-hidden className="size-5" />
            <span className="sr-only">{t("openMenu")}</span>
          </SheetTrigger>
          <SheetContent
            // The whole drawer scrolls on short phones: menu and account together.
            className="gap-6 overflow-y-auto bg-navy p-4"
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">{t("menuTitle")}</SheetTitle>
            <div className="flex items-center justify-between">
              <Brand onNavigate={closeMenu} />
              <SheetClose
                className={cn(
                  "grid size-10 place-items-center rounded-lg text-white hover:bg-white/10",
                  onNavy,
                )}
              >
                <XIcon aria-hidden className="size-5" />
                <span className="sr-only">{t("closeMenu")}</span>
              </SheetClose>
            </div>
            <SidebarBody items={items} onNavigate={closeMenu} inDrawer />
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      {/* From 1024 px: the sidebar. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 bg-navy px-4 py-6 lg:flex">
        <Brand />
        <SidebarBody items={items} />
      </aside>

      <main
        id="content"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-7xl min-w-0 flex-1 content-start gap-6 px-4 py-6 outline-none md:px-8 md:py-8"
      >
        {children}
      </main>
    </div>
  );
}

/** `onNavigate`: in the drawer, any link closes it (also one to the page already open). */
function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Shell");
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={cn("flex items-center gap-2 rounded-lg px-2 py-1", onNavy)}
    >
      <span className="grid size-8 place-items-center rounded-full bg-white">
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
      </span>
      <span className="font-display text-section font-bold text-white">
        {t("brand")}
      </span>{" "}
      <span className="text-meta font-semibold tracking-wider text-sun uppercase">
        {t("brandTag")}
      </span>
    </Link>
  );
}

/** Any change of page (a link, Back) closes the drawer. */
function CloseOnNavigation({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}

const groupLabels = {
  operations: "groupOperations",
  people: "groupPeople",
  places: "groupPlaces",
  admin: "groupAdmin",
} as const satisfies Record<NavGroup, string>;

/** Above this, the count shows "99+". */
const MAX_COUNT = 99;

function SidebarBody({
  items,
  onNavigate,
  inDrawer = false,
}: {
  items: readonly NavItem[];
  onNavigate?: () => void;
  /**
   * In the drawer the whole drawer scrolls. In the sidebar only the menu does, keeping the
   * account in view.
   */
  inDrawer?: boolean;
}) {
  const t = useTranslations("Shell");
  const { data: staff } = useCurrentStaff();
  const visible = visibleNavItems(items, staff?.role);
  const openRequests = useOpenRequestCount();
  // The items that can show a count, always listed (the count is shown only above 0).
  const counts: Partial<Record<NavItem["key"], number>> = {
    routeRequests: openRequests,
  };

  return (
    <div className={cn("flex flex-1 flex-col gap-6", !inDrawer && "min-h-0")}>
      <nav
        aria-label={t("navLabel")}
        className="-mx-1 grid gap-5 overflow-y-auto px-1"
      >
        <NavList
          items={visible.filter((item) => !item.group)}
          counts={counts}
          onNavigate={onNavigate}
        />
        {navGroups.map((group) => {
          const grouped = visible.filter((item) => item.group === group);
          return grouped.length === 0 ? null : (
            <NavList
              key={group}
              heading={t(groupLabels[group])}
              items={grouped}
              counts={counts}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>
      <div className="mt-auto">
        <AccountPanel />
      </div>
    </div>
  );
}

function NavList({
  heading,
  items,
  counts,
  onNavigate,
}: {
  /** Names the list (a group's heading). */
  heading?: string;
  items: NavItem[];
  counts: Partial<Record<NavItem["key"], number>>;
  onNavigate?: () => void;
}) {
  const id = useId();
  const headingId = `${id}-heading`;
  return (
    <div className="grid gap-1">
      {heading && (
        <p
          id={headingId}
          className="px-3 text-meta font-semibold tracking-wider text-white/70 uppercase"
        >
          {heading}
        </p>
      )}
      <ul
        aria-labelledby={heading ? headingId : undefined}
        className="grid gap-0.5"
      >
        {items.map((item) => {
          // Items that can show a count (fixed, whatever the count is right now).
          const countId = item.key in counts ? `${id}-${item.key}` : undefined;
          return (
            <li key={item.key} className="relative">
              {/*
                The current page comes from the URL. On pages with an id in it (/companies/[id])
                that is only known at request time, so until then the link shows unmarked
                (node_modules/next/dist/docs: usePathname, "Cache Components"). Only the mark
                waits: what depends on data (which links show, the count) stays outside, so a
                boundary that hydrates late can't render differently from the server.
              */}
              <Suspense
                fallback={
                  <NavLink
                    item={item}
                    countId={countId}
                    current={false}
                    onNavigate={onNavigate}
                  />
                }
              >
                <CurrentNavLink
                  item={item}
                  countId={countId}
                  onNavigate={onNavigate}
                />
              </Suspense>
              {countId && <NavCount id={countId} count={counts[item.key]} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Waiting work beside a link, e.g. open route requests: a sun count when above 0. The link is
 * described by it ("Route requests", "6 open"); it sits over the link's right end and lets clicks
 * through to it.
 */
function NavCount({ id, count }: { id: string; count: number | undefined }) {
  const t = useTranslations("Shell");
  const shown = count && count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);
  return (
    <span
      id={id}
      className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
    >
      {count ? (
        <>
          <span
            aria-hidden
            className="min-w-6 rounded-full bg-sun px-1.5 text-center text-meta leading-5 font-semibold text-navy"
          >
            {shown}
          </span>
          <span className="sr-only">{t("openRequests", { count: shown })}</span>
        </>
      ) : null}
    </span>
  );
}

function CurrentNavLink(props: {
  item: NavItem;
  countId?: string;
  onNavigate?: () => void;
}) {
  const current = isCurrentPath(props.item.href, usePathname());
  return <NavLink {...props} current={current} />;
}

function NavLink({
  item,
  countId,
  current,
  onNavigate,
}: {
  item: NavItem;
  /** The NavCount that describes this link, if it can have one. */
  countId?: string;
  current: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Shell.nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      aria-describedby={countId}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-body text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white",
        // Room for the count.
        countId && "pr-14",
        onNavy,
        current &&
          "bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-blue",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-[18px] shrink-0",
          current ? "text-white" : "text-white/70",
        )}
      />
      <span className="min-w-0 truncate">{t(item.key)}</span>
    </Link>
  );
}
