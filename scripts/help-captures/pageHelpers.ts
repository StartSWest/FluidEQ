/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What the steps and finders are written against (`figures.ts`). Waiting is
 * by frames painted, never by a clock: `until` gives up after a number of
 * frames, and `settle` waits on the fonts and on every animation that ends.
 */
export const HELPERS = `
(() => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
  const $ = (css, root = document) => root.querySelector(css);
  const $$ = (css, root = document) => [...root.querySelectorAll(css)];
  const ownText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim();
  const byText = (root, words) => {
    if (!root) return null;
    const all = [root, ...root.querySelectorAll('*')];
    return all.find((element) => ownText(element).startsWith(words)) ?? null;
  };
  const rowOf = (element) =>
    element?.closest('button, [role=menuitem], [role=menuitemcheckbox], label, a') ?? element;
  const union = (...elements) => elements.filter(Boolean);
  const until = async (test, frames = 900) => {
    for (let at = 0; at < frames; at += 1) {
      if (test()) return;
      await frame();
    }
    throw new Error('Never became true: ' + test.toString());
  };
  const click = (element) => {
    if (!element) throw new Error('Nothing to click');
    const box = element.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
      button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    element.dispatchEvent(new PointerEvent('pointerdown', at));
    element.dispatchEvent(new MouseEvent('mousedown', at));
    element.dispatchEvent(new PointerEvent('pointerup', { ...at, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...at, buttons: 0 }));
  };
  const settle = async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await frame();
    await frame();
  };
  const rectOf = (found) => {
    const elements = (Array.isArray(found) ? found : [found]).filter(Boolean);
    if (elements.length === 0) return null;
    const boxes = elements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  };
  Object.assign(window, { __capture: { frame, $, $$, byText, rowOf, union, until, click, settle, rectOf } });
})();
`;

export const inPage = (body: string) =>
  `(async () => { const { frame, $, $$, byText, rowOf, union, until, click, settle, rectOf } = window.__capture; ${body} })()`;
