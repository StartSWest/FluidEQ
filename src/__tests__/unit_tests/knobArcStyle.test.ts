/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A dial's lit arc follows its pointer exactly: nothing about it is eased.
 *
 * The arc is a dash — its offset is where it starts, its length how far it
 * runs — and on a dial grown from the centre both change as a value below
 * zero moves. An offset eased under a length that changed at once moved the
 * zero end with every turn and smeared the arc behind the pointer (Ivan,
 * 2026-09-23: "el 0 se mueve también"). Nothing renders a stylesheet in the
 * suite, so this compiles the dial's and reads what it says about the arc.
 */
import path from 'path';
import { compile } from 'sass';

const STYLES = path.join(__dirname, '..', '..', 'renderer', 'styles');

/** Every declaration block of `selector` in compiled CSS that eases anything. */
const easedBlocks = (css: string, selector: string): string[] =>
  css.split('}').filter((block) => {
    const [selectors = '', body = ''] = block.split('{');
    return (
      selectors.split(',').some((one) => one.trim().endsWith(selector)) &&
      /\b(transition|animation)\b/.test(body)
    );
  });

describe('the dial arc', () => {
  it('eases nothing, so its zero end stays where zero is', () => {
    const { css } = compile(path.join(STYLES, 'Knob.scss'), {
      loadPaths: [STYLES],
      quietDeps: true,
    });
    expect(css).toContain('.knob__value');
    expect(easedBlocks(css, '.knob__value')).toEqual([]);
  });

  it('(the check sees the rule that moved it)', () => {
    const shipped =
      '.knob__value {\n  stroke: #26c6da;\n  transition: stroke-dashoffset 120ms ease;\n}';
    expect(easedBlocks(shipped, '.knob__value')).toHaveLength(1);
  });
});
