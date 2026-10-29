/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * On a window narrower than the medium breakpoint a dialog stacks its rail
 * over its body (`DialogFrame.scss`), because every dialog is portalled to
 * the window and sized against it. A dialog drawn in Help is not: it is laid
 * out at its own width and scaled to its figure, and under that rule the
 * guide's desktop dialog came out stacked on a 900px sheet — a layout no
 * window shows — with its last setting scrolled out from under its call-out.
 * jsdom lays nothing out, so what is held here is the compiled rule.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const NARROW = '@media (max-width: 768px) {';
const OUTSIDE_HELP = ':where(:not(.help-live *))';

/** Each rule's selector list inside the narrow-window block, in order. */
const narrowRules = () => {
  const { css } = compile(path.join(STYLES_DIR, 'DialogFrame.scss'), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  });
  const at = css.indexOf(NARROW);
  if (at < 0) {
    throw new Error('no narrow-window block');
  }
  const rules: { selectors: string[]; body: string }[] = [];
  let depth = 1;
  let start = at + NARROW.length;
  for (let index = start; depth > 0; index += 1) {
    if (css[index] === '{') {
      depth += 1;
      if (depth === 2) {
        const close = css.indexOf('}', index);
        rules.push({
          selectors: css
            .slice(start, index)
            .split(',')
            .map((selector) => selector.trim()),
          body: css.slice(index + 1, close).replace(/\s+/g, ' '),
        });
      }
    } else if (css[index] === '}') {
      depth -= 1;
      start = index + 1;
    }
  }
  return rules;
};

describe('the dialog frame on a narrow window', () => {
  const rules = narrowRules();

  // The positive control: the stacked layout is still there for a dialog on
  // the window, or "every selector is scoped" holds of an empty block.
  it('still stacks the rail over the body for a dialog on the window', () => {
    const frame = rules.find(({ selectors }) =>
      selectors.includes(`.dialog-frame${OUTSIDE_HELP}`),
    );
    expect(frame?.body).toContain('grid-template-areas: "rail" "body" "foot"');
    expect(rules.length).toBeGreaterThan(5);
  });

  it('leaves every part of a dialog drawn in Help at its own layout', () => {
    rules
      .flatMap(({ selectors }) => selectors)
      .forEach((selector) => expect(selector).toContain(OUTSIDE_HELP));
  });
});
