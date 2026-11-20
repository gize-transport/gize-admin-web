"use client";

import { EllipsisIcon, LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { showSuccessToast } from "@/components/toast";
import { cn } from "@/lib/utils";

/**
 * Where a failed Copy link is reported: DetailHeader shows the message under its pinned row.
 * Without one (the menu on its own), the menu shows it after its button.
 */
export const NoticeContext = createContext<((failed: boolean) => void) | null>(
  null,
);

export function CopyFailedNotice({ className }: { className?: string }) {
  const t = useTranslations("Detail");
  return (
    <p role="alert" className={cn("text-table text-danger", className)}>
      {t("copyLinkFailed")}
    </p>
  );
}

type MenuContext = {
  /** Runs an item's action once the menu has closed and focus is back on its button. */
  run: (action: () => void) => void;
  setCopyFailed: (failed: boolean) => void;
};

const Context = createContext<MenuContext | null>(null);

function useMenu() {
  const context = useContext(Context);
  if (!context) throw new Error("Use inside <ActionsMenu>");
  return context;
}

/**
 * A record's other actions behind one "⋯" button in its header (GZW-077; design-system.md,
 * "Detail panel / page"). An item's action runs after the menu closes and focus is back on the
 * button, so a dialog it opens returns focus there when it closes.
 */
export function ActionsMenu({
  name,
  ref,
  children,
}: {
  /** The record, for the button's name: "Actions for B-01". */
  name: string;
  /** The button, e.g. to move focus to it after the button that had it goes away. */
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  const t = useTranslations("Detail");
  const label = t("actions", { name });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const [ownCopyFailed, setOwnCopyFailed] = useState(false);
  const report = useContext(NoticeContext);
  const setCopyFailed = report ?? setOwnCopyFailed;

  return (
    <Context
      value={{
        run: (action) => {
          pending.current = action;
        },
        setCopyFailed,
      }}
    >
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(open) => {
          if (open) setCopyFailed(false);
        }}
      >
        <DropdownMenu.Trigger
          ref={(element) => {
            trigger.current = element;
            if (typeof ref === "function") ref(element);
            else if (ref) ref.current = element;
          }}
          aria-label={label}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-navy transition-colors duration-150 hover:border-royal hover:bg-ice aria-expanded:border-royal aria-expanded:bg-ice"
        >
          <EllipsisIcon aria-hidden className="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            aria-label={label}
            aria-labelledby={undefined}
            align="end"
            sideOffset={4}
            onCloseAutoFocus={(event) => {
              const action = pending.current;
              if (!action) return;
              pending.current = null;
              event.preventDefault();
              trigger.current?.focus();
              action();
            }}
            className="z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
          >
            {children}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {!report && ownCopyFailed && <CopyFailedNotice className="basis-full" />}
    </Context>
  );
}

export function ActionsMenuItem({
  onSelect,
  immediate = false,
  tone,
  icon,
  children,
}: {
  onSelect: () => void;
  /**
   * Run while the menu is still open, in the click itself (Copy link: browsers only let the
   * clipboard be written during a click). Only for actions that open nothing.
   */
  immediate?: boolean;
  /** "danger": a destructive action (delete), in red. */
  tone?: "danger";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const { run } = useMenu();
  return (
    <DropdownMenu.Item
      data-tone={tone}
      onSelect={() => (immediate ? onSelect() : run(onSelect))}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-table text-ink outline-none select-none data-highlighted:bg-ice [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted",
        tone === "danger" &&
          "text-danger data-highlighted:bg-danger/10 [&_svg]:text-danger",
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function ActionsMenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-line" />;
}

/** Copies the record's page address (its id only – no personal data), e.g. to send a colleague. */
export function CopyLinkItem({ path }: { path: string }) {
  const t = useTranslations("Detail");
  const { setCopyFailed } = useMenu();
  return (
    <ActionsMenuItem
      immediate
      icon={<LinkIcon aria-hidden />}
      onSelect={() => {
        // No clipboard outside a secure page (http other than localhost): writeText is missing.
        if (!navigator.clipboard?.writeText) {
          setCopyFailed(true);
          return;
        }
        navigator.clipboard
          .writeText(new URL(path, window.location.origin).href)
          .then(
            () => showSuccessToast(t("linkCopied")),
            () => setCopyFailed(true),
          );
      }}
    >
      {t("copyLink")}
    </ActionsMenuItem>
  );
}
