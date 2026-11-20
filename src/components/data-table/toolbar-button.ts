/**
 * The look of a list toolbar's controls (filter menus, pickers): one height, one shape. Marked
 * `data-active` while their filter is on (light blue), so it shows without opening them.
 */
export const toolbarButtonClass =
  "inline-flex h-9 max-w-64 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-table font-medium whitespace-nowrap text-ink transition-colors duration-150 hover:border-royal hover:bg-ice data-active:border-royal data-active:bg-ice data-active:text-navy aria-expanded:border-royal [&_svg]:size-4 [&_svg]:shrink-0";
