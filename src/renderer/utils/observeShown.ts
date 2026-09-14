/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether anybody can see `element`, reported only when the answer changes.
 *
 * An IntersectionObserver alone was what every loop in the window trusted,
 * and it answers a narrower question — "is the box inside the viewport" — so
 * three ordinary ways of hiding something went unnoticed and kept a GPU loop
 * drawing at the display's rate:
 *
 *  - `visibility: hidden` on an ancestor, which is how the expanded graph
 *    hides everything above it, Studio stage and scene previews included;
 *  - `opacity: 0`, which is how full screen hides the titlebar's wave;
 *  - another element in full screen, which is how the Studio's full stage
 *    covers the graph's own scene.
 *
 * Each of those arrives as a real event here — a class or style attribute
 * changing on an ancestor, a transition or animation on one finishing,
 * `fullscreenchange`, `visibilitychange` — and nothing is sampled on a clock.
 */
export default function observeShown(
  element: Element,
  onChange: (shown: boolean) => void,
): () => void {
  let intersecting = true;
  let shown: boolean | undefined;

  const evaluate = () => {
    const fullScreen = document.fullscreenElement;
    const next =
      !document.hidden &&
      element.isConnected &&
      intersecting &&
      // `null` while nothing is in full screen, and absent altogether in
      // jsdom: a check for `null` alone read jsdom's `undefined` as an element
      // in full screen and threw on it.
      (!fullScreen || fullScreen.contains(element)) &&
      // Absent in jsdom, where nothing is ever painted to hide.
      (typeof element.checkVisibility !== 'function' ||
        element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        }));
    if (next !== shown) {
      shown = next;
      onChange(next);
    }
  };

  const intersection =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          intersecting = entries.some((entry) => entry.isIntersecting);
          evaluate();
        })
      : undefined;
  intersection?.observe(element);

  // Every ancestor's own attributes, and not their subtrees: the meters and
  // scenes inside write inline styles every frame, and a subtree observer
  // would wake on each of those writes. The root's `style` is left out for
  // the same reason — the window's tint lands there on every beat — while its
  // `class` is kept, since the shell's modes are classes.
  const mutations =
    typeof MutationObserver === 'function'
      ? new MutationObserver(evaluate)
      : undefined;
  for (
    let node: Element | null = element;
    node !== null;
    node = node.parentElement
  ) {
    mutations?.observe(node, {
      attributes: true,
      attributeFilter:
        node === document.documentElement
          ? ['class', 'hidden', 'inert']
          : ['class', 'style', 'hidden', 'inert'],
    });
  }

  // A class that starts a fade has already been seen by the time the fade
  // reaches zero; the end of the transition is the moment the answer changes.
  const onMotionEnd = (event: Event) => {
    if (event.target instanceof Node && event.target.contains(element)) {
      evaluate();
    }
  };

  document.addEventListener('visibilitychange', evaluate);
  document.addEventListener('fullscreenchange', evaluate);
  document.addEventListener('transitionend', onMotionEnd, true);
  document.addEventListener('animationend', onMotionEnd, true);
  evaluate();

  return () => {
    intersection?.disconnect();
    mutations?.disconnect();
    document.removeEventListener('visibilitychange', evaluate);
    document.removeEventListener('fullscreenchange', evaluate);
    document.removeEventListener('transitionend', onMotionEnd, true);
    document.removeEventListener('animationend', onMotionEnd, true);
  };
}
