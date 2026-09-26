/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A callback ref that keeps an element's own height on it as a custom
 * property, in whole pixels, for its descendants to size themselves from.
 *
 * The stand-in for `100cqh` where the element is laid out often. A length in
 * container units is resolved again every time its container is laid out, so
 * the EQ's band rail — a size container — restyled all ten sliders and laid
 * the page out a second time on every step of a drag: 800ms of layout over a
 * measured sweep, 192ms written this way. A ResizeObserver reports only when
 * the height changes, and the property is set on the element directly rather
 * than through a render.
 *
 * The element needs `contain: size` (or a height from its grid row) so the
 * height it reports is not one its own descendants gave it.
 */
const heightProperty =
  (property: `--${string}`) =>
  (element: HTMLElement | null): (() => void) | undefined => {
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const latest = entries[entries.length - 1];
      if (latest) {
        element.style.setProperty(
          property,
          `${Math.round(latest.contentRect.height)}px`,
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  };

export default heightProperty;
