"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isForbidden } from "@/lib/api/problem";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useSignOut } from "@/lib/auth/use-sign-out";
import { cn } from "@/lib/utils";
import { AccountPanel } from "./account-panel";
import {
  isCurrentPath,
  navItems,
  visibleNavItems,
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
  const pathname = usePathname();
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

  // Any change of page (a link, Back) closes the drawer.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

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
            className="gap-6 bg-navy p-4"
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
            <SidebarBody
              items={items}
              pathname={pathname}
              onNavigate={closeMenu}
            />
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      {/* From 1024 px: the sidebar. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 bg-navy px-4 py-6 lg:flex">
        <Brand />
        <SidebarBody items={items} pathname={pathname} />
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

function SidebarBody({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Shell");
  const { data: staff } = useCurrentStaff();
  const visible = visibleNavItems(items, staff?.role);
  const ungrouped = visible.filter((item) => !item.group && !item.adminOnly);
  const places = visible.filter((item) => item.group === "places");
  const admin = visible.filter((item) => item.adminOnly);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <nav aria-label={t("navLabel")} className="grid gap-4 overflow-y-auto">
        <NavList
          items={ungrouped}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        {places.length > 0 && (
          <div className="grid gap-1">
            <p className="px-3 text-meta font-semibold tracking-wider text-white/70 uppercase">
              {t("groupPlaces")}
            </p>
            <NavList
              items={places}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </div>
        )}
        {admin.length > 0 && (
          <NavList items={admin} pathname={pathname} onNavigate={onNavigate} />
        )}
      </nav>
      <div className="mt-auto">
        <AccountPanel />
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Shell.nav");
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => {
        const current = isCurrentPath(item.href, pathname);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cn(
                "relative flex min-h-10 items-center rounded-lg px-3 text-body text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white",
                onNavy,
                current &&
                  "bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-blue",
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
