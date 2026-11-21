"use client";

import {
  CircleAlertIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  XIcon,
} from "lucide-react";
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
import { Avatar } from "@/components/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { saveSidebarCollapsed } from "./sidebar-state";

// Inside the navy sidebar the royal focus ring is too faint (under 3:1), so it is white there.
const onNavy = "focus-visible:outline-white";

type PortalShellProps = {
  children: ReactNode;
  /** Tests pass the full list; the app uses `navItems`. */
  items?: readonly NavItem[];
  /** The sidebar starts as icons only (the last page left it so; sidebar-state.ts). */
  defaultCollapsed?: boolean;
};

/**
 * The signed-in portal: navy sidebar (from 1024 px; it collapses to icons, GZW-082) or a top bar
 * with a menu drawer, and the page in `<main>` (design-system.md, "Layout"; Admin mockup).
 */
export function PortalShell({
  children,
  items = navItems,
  defaultCollapsed = false,
}: PortalShellProps) {
  const t = useTranslations("Shell");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    saveSidebarCollapsed(!collapsed);
  };
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

      {/* From 1024 px: the sidebar, open or as icons only. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 bg-navy py-6 lg:flex",
          collapsed ? "w-[72px] px-3" : "w-64 px-4",
        )}
      >
        <TooltipProvider>
          <div
            className={cn(
              "flex items-center gap-2",
              collapsed ? "flex-col" : "justify-between",
            )}
          >
            <Brand compact={collapsed} />
            {/* The same button in both states, so focus stays on it. */}
            <Tooltip>
              <TooltipTrigger asChild>
                {/* See NavLink: the tooltip sits on a wrapper, so it isn't read twice. */}
                <span className="grid shrink-0">
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    className={cn(
                      "grid size-9 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white",
                      onNavy,
                    )}
                  >
                    {collapsed ? (
                      <PanelLeftOpenIcon aria-hidden className="size-[18px]" />
                    ) : (
                      <PanelLeftCloseIcon aria-hidden className="size-[18px]" />
                    )}
                    <span className="sr-only">
                      {collapsed ? t("expandSidebar") : t("collapseSidebar")}
                    </span>
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? t("expandSidebar") : t("collapseSidebar")}
              </TooltipContent>
            </Tooltip>
          </div>
          <SidebarBody items={items} collapsed={collapsed} />
        </TooltipProvider>
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

/**
 * `onNavigate`: in the drawer, any link closes it (also one to the page already open).
 * `compact`: the collapsed sidebar shows the logo only (the name stays for screen readers).
 */
function Brand({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
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
      <span
        className={cn(
          "font-display text-section font-bold text-white",
          compact && "sr-only",
        )}
      >
        {t("brand")}
      </span>{" "}
      <span
        className={cn(
          "text-meta font-semibold tracking-wider text-sun uppercase",
          compact && "sr-only",
        )}
      >
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

function formatCount(count: number) {
  return count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);
}

function SidebarBody({
  items,
  onNavigate,
  inDrawer = false,
  collapsed = false,
}: {
  items: readonly NavItem[];
  onNavigate?: () => void;
  /** Icons only (the sidebar, never the drawer). */
  collapsed?: boolean;
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
          collapsed={collapsed}
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
              collapsed={collapsed}
            />
          );
        })}
      </nav>
      <div className={cn("mt-auto", collapsed && "grid justify-items-center")}>
        {collapsed ? <AccountButton /> : <AccountPanel />}
      </div>
    </div>
  );
}

function NavList({
  heading,
  items,
  counts,
  onNavigate,
  collapsed = false,
}: {
  /** Names the list (a group's heading). */
  heading?: string;
  items: NavItem[];
  counts: Partial<Record<NavItem["key"], number>>;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const t = useTranslations("Shell");
  const id = useId();
  const headingId = `${id}-heading`;
  return (
    <div className="grid gap-1">
      {heading && (
        <p
          id={headingId}
          className={cn(
            "px-3 text-meta font-semibold tracking-wider text-white/70 uppercase",
            // Collapsed: still names the list, shown as a thin line.
            collapsed && "sr-only",
          )}
        >
          {heading}
        </p>
      )}
      {heading && collapsed && (
        <span aria-hidden className="mx-2 mb-1 h-px bg-white/15" />
      )}
      <ul
        aria-labelledby={heading ? headingId : undefined}
        className="grid gap-0.5"
      >
        {items.map((item) => {
          // Items that can show a count (fixed, whatever the count is right now).
          const countId = item.key in counts ? `${id}-${item.key}` : undefined;
          const count = counts[item.key];
          // Collapsed, the name (and the count the dot stands for) shows on hover and focus.
          const tooltip = collapsed
            ? [
                t(`nav.${item.key}`),
                count ? t("openRequests", { count: formatCount(count) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined;
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
                    tooltip={tooltip}
                  />
                }
              >
                <CurrentNavLink
                  item={item}
                  countId={countId}
                  onNavigate={onNavigate}
                  tooltip={tooltip}
                />
              </Suspense>
              {countId && (
                <NavCount id={countId} count={count} collapsed={collapsed} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Waiting work beside a link, e.g. open route requests: a sun count when above 0 (a sun dot on the
 * icon when collapsed). The link is described by it ("Route requests", "6 open"); it sits over the
 * link and lets clicks through to it.
 */
function NavCount({
  id,
  count,
  collapsed,
}: {
  id: string;
  count: number | undefined;
  collapsed: boolean;
}) {
  const t = useTranslations("Shell");
  const shown = formatCount(count ?? 0);
  return (
    <span
      id={id}
      className={cn(
        "pointer-events-none absolute flex items-center",
        collapsed ? "top-1.5 right-2.5" : "inset-y-0 right-3",
      )}
    >
      {count ? (
        <>
          {collapsed ? (
            <span
              aria-hidden
              className="size-2.5 rounded-full bg-sun ring-2 ring-navy"
            />
          ) : (
            <span
              aria-hidden
              className="min-w-6 rounded-full bg-sun px-1.5 text-center text-meta leading-5 font-semibold text-navy"
            >
              {shown}
            </span>
          )}
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
  tooltip?: string;
}) {
  const current = isCurrentPath(props.item.href, usePathname());
  return <NavLink {...props} current={current} />;
}

function NavLink({
  item,
  countId,
  current,
  onNavigate,
  tooltip,
}: {
  item: NavItem;
  /** The NavCount that describes this link, if it can have one. */
  countId?: string;
  current: boolean;
  onNavigate?: () => void;
  /** Collapsed sidebar: the icon only, and this on hover and focus. */
  tooltip?: string;
}) {
  const t = useTranslations("Shell.nav");
  const Icon = item.icon;
  const collapsed = tooltip !== undefined;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      aria-describedby={countId}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-body text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white",
        collapsed && "justify-center px-0",
        // Room for the count.
        countId && !collapsed && "pr-14",
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
      <span className={collapsed ? "sr-only" : "min-w-0 truncate"}>
        {t(item.key)}
      </span>
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      {/*
        The tooltip opens from a wrapper (focus and hover reach it from the link), as Radix
        would add it to the link's description: the label already names the link, so it would be
        read twice. Only the count describes the link.
      */}
      <TooltipTrigger asChild>
        <span className="block">{link}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Foot of the collapsed sidebar: the initials, opening the account card (name, role, Sign out)
 * beside them. While loading a placeholder; on an error an alert icon and a name that says so,
 * the card says what and offers Retry.
 */
function AccountButton() {
  const t = useTranslations("Shell");
  const staff = useCurrentStaff();
  const [open, setOpen] = useState(false);
  const name = staff.data?.full_name;
  const failed = staff.isError && !isForbidden(staff.error);
  const label = failed ? t("accountProblem") : t("account");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* See NavLink: on a wrapper, so the tooltip isn't read as well. */}
          <span className="grid">
            <PopoverTrigger
              className={cn(
                "grid size-12 place-items-center rounded-full hover:bg-white/10",
                onNavy,
              )}
            >
              {name ? (
                <Avatar name={name} className="bg-sky text-navy" />
              ) : failed ? (
                <CircleAlertIcon aria-hidden className="size-5 text-white" />
              ) : (
                <Skeleton className="size-9 rounded-full bg-white/15" />
              )}
              <span className="sr-only">{label}</span>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        {/* Not over the open card: it would cover Sign out and take its click. */}
        {!open && <TooltipContent side="right">{name ?? label}</TooltipContent>}
      </Tooltip>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        aria-label={t("account")}
        className="w-64 rounded-xl border-0 bg-navy p-0"
      >
        <AccountPanel />
      </PopoverContent>
    </Popover>
  );
}
