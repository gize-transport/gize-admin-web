import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no layout, so it has no ResizeObserver; components only use it for measurements.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom doesn't scroll either; cmdk scrolls the active option into view. (Node-environment
// test files have no DOM at all.)
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
}

afterEach(() => {
  cleanup();
});
