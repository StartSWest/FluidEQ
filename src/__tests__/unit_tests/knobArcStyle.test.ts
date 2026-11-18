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
  // The lit arc is the value's ring (`KnobDial`, the slider's parts bent
  // round since 2026-11-17), which takes its dash from its group: neither
  // the ring nor the group may ease.
  it('eases nothing, so its zero end stays where zero is', () => {
    const { css } = compile(path.join(STYLES, 'Knob.scss'), {
      loadPaths: [STYLES],
      quietDeps: true,
    });
    expect(css).toContain('.knob__fill');
    expect(easedBlocks(css, '.knob__fill')).toEqual([]);
    expect(easedBlocks(css, '.knob__value')).toEqual([]);
  });

  it('(the check sees the rule that moved it)', () => {
    const shipped =
      '.knob__neon {\n  stroke: #26c6da;\n  transition: stroke-dashoffset 120ms ease;\n}';
    expect(easedBlocks(shipped, '.knob__neon')).toHaveLength(1);
  });
});

describe('the knob under the pointer', () => {
  // Only the ring round it lights: the well its arc runs in takes the hover
  // tint (since 2026-11-17, when the glass and the pointer's glow went with
  // the neon tube). Lighting the body's edge, the side wall and
  // a ring round the knob as well lit every border of it at once (Ivan,
  // 2026-09-27: "it highlights all borders, not good", "the hover needs to
  // highlight the external arc").
  it('lights its ring, nothing on its body', () => {
    const { css } = compile(path.join(STYLES, 'Knob.scss'), {
      loadPaths: [STYLES],
      quietDeps: true,
    });
    const hovered = css
      .split('}')
      .map((block) => block.split('{')[0] ?? '')
      .filter((selectors) => selectors.includes('.knob:hover'))
      .flatMap((selectors) => selectors.split(',').map((one) => one.trim()));
    expect(hovered.length).toBeGreaterThan(0);
    hovered.forEach((selector) => {
      expect(selector).toMatch(/\.knob__well$/);
    });
  });
});

describe('the reading under the knob', () => {
  // A unit is read: the faint tier, not the dim one, which measured 2.99:1 at
  // 100% for the knobs' Hz, dB and Q.
  it('writes its unit in the faint tier', () => {
    const { css } = compile(path.join(STYLES, 'Knob.scss'), {
      loadPaths: [STYLES],
      quietDeps: true,
    });
    const unit = css
      .split('}')
      .find((block) =>
        (block.split('{')[0] ?? '')
          .split(',')
          .some((one) => one.trim() === '.knob-readout__unit'),
      );
    expect(unit).toMatch(/color:\s*var\(--text-faint\)/);
  });
});
