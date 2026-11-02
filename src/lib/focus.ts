/**
 * For a dialog's `onCloseAutoFocus`: focus goes back to the element that opened it (WCAG 2.4.3).
 * When that element is gone (the row that was deleted or moved out of the list, the empty state's
 * button once the list has rows), it goes to the page content – the shell's <main id="content">,
 * as the skip link – so it doesn't drop to the top of the document. Next may keep earlier pages'
 * hidden <main> in the document, so not just "main".
 */
export function returnFocus(event: Event, opener: HTMLElement | null) {
  event.preventDefault();
  if (opener?.isConnected) opener.focus();
  else document.getElementById("content")?.focus();
}
