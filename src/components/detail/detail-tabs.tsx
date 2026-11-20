"use client";

import { Tabs } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useListParams } from "@/components/data-table/use-list-params";

export type DetailTab = {
  /** Kept in the address (`?tab=status`); the first tab is the default and isn't written. */
  value: string;
  label: ReactNode;
  content: ReactNode;
};

/**
 * A long record split into tabs (GZW-078; design-system.md, "Detail panel / page"). The open tab
 * is kept in the address, replacing it (Back doesn't step through tabs), so a shared link and
 * Back from another page open the same tab; an unknown or unavailable value shows the first.
 * Arrow keys move between tabs. Every tab stays mounted, hidden while another is shown, so its
 * work (a launch being watched, an open form) carries on while staff look elsewhere.
 */
export function DetailTabs({
  label,
  tabs,
  param = "tab",
}: {
  /** Names the tab list, e.g. "B-01 sections". */
  label: string;
  tabs: readonly DetailTab[];
  param?: string;
}) {
  const { get, setParams } = useListParams();
  const first = tabs[0]?.value ?? "";
  const asked = get(param);
  const fromUrl = tabs.some((tab) => tab.value === asked) ? asked! : first;
  // Shown at once when picked (the address follows a moment later), and follows the address when
  // it changes otherwise (Back, a link).
  const [state, setState] = useState({ url: fromUrl, tab: fromUrl });
  let current = state.tab;
  if (state.url !== fromUrl) {
    setState({ url: fromUrl, tab: fromUrl });
    current = fromUrl;
  }
  if (!tabs.some((tab) => tab.value === current)) current = first;

  return (
    <Tabs.Root
      value={current}
      onValueChange={(value) => {
        setState({ url: fromUrl, tab: value });
        setParams(
          { [param]: value === first ? null : value },
          { replace: true },
        );
      }}
      className="grid content-start gap-6"
    >
      <Tabs.List
        aria-label={label}
        // The line under the tabs is an inset shadow, so the open tab's underline covers it
        // without poking out of the scrolling list (phones scroll it sideways if it must).
        className="flex gap-4 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)] sm:gap-6"
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-0.5 pt-1 pb-2.5 text-table font-semibold whitespace-nowrap text-muted transition-colors duration-150 hover:text-navy data-[state=active]:border-royal data-[state=active]:text-navy"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.value}
          value={tab.value}
          forceMount
          // Kept mounted (forceMount) but hidden from everyone while another tab is shown.
          hidden={tab.value !== current}
          // Focusable (Radix: Tab from the list lands here), with the site's focus ring.
          className="grid content-start gap-6 data-[state=inactive]:hidden"
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
