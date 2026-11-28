/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the Scenes rail's account card lays itself out, read from the compiled
 * rules: jsdom lays nothing out, so a card spilling out of a 180px rail or a
 * picture off the folded column could only be seen in a window. Each case
 * holds the rule that keeps it so; the pixels were measured in the harness
 * (`.claude/plus-harness`, 180/236/420 px, dark and white, French).
 */

import fs from 'fs';
import path from 'path';
import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

const community = styleRules(compileStylesheet('CommunityRail.scss'));
const plusRail = styleRules(compileStylesheet('PlusRail.scss'));

const ruleOf = (rules: IRule[], selector: string, within = 0): IRule => {
  const found = rules.filter(
    (rule) =>
      rule.selectors.includes(selector) && rule.within.length === within,
  );
  if (found.length === 0) {
    throw new Error(`no rule for ${selector}`);
  }
  return found[found.length - 1];
};
const value = (
  rules: IRule[],
  selector: string,
  property: string,
): string | undefined => ruleOf(rules, selector).declarations.get(property);
const px = (text: string | undefined): number => {
  const match = /(-?[\d.]+)px/.exec(text ?? '');
  if (!match) {
    throw new Error(`no length in ${text}`);
  }
  return Number(match[1]);
};

/** The folded rail's width, from the token every rail folds to. */
const foldedRail = (() => {
  const tokens = fs.readFileSync(
    path.join(__dirname, '../../../renderer/styles/_libraryTokens.scss'),
    'utf8',
  );
  const match = /\$studio-rail-folded:\s*(\d+)px/.exec(tokens);
  if (!match) {
    throw new Error('no $studio-rail-folded token');
  }
  return Number(match[1]);
})();

describe('the Scenes rail’s account card, as laid out', () => {
  /**
   * Folded, the rail is a column of glyphs, and the member's picture stands
   * in it. The card's inset assumed a 30px picture after the picture grew
   * to 36px, which put it 3px right of the column.
   */
  it('stands the member’s picture on the folded rail’s glyph column', () => {
    const footInline = px(
      value(plusRail, '.community--plus .community__foot', 'padding')?.split(
        ' ',
      )[1],
    );
    const border = px(value(community, '.community__account', 'border'));
    const inset = px(
      value(
        plusRail,
        '.community--plus .community__account',
        'padding-inline-start',
      ),
    );
    const picture = px(
      value(community, '.community__account .community__avatar', 'width'),
    );
    expect(picture).toBe(36);
    expect(footInline + border + inset + picture / 2).toBe(foldedRail / 2);
  });

  /**
   * On the narrowest rail the old card had a handle, Plus and the maker's
   * tag on one line, the last two refusing to shrink, and the tag stood out
   * of the card. Now a role stands by the name, which is what gives way, the
   * line holds one thing that never shrinks, and a cancelled date wraps.
   */
  it('gives way on a narrow rail instead of spilling out of the card', () => {
    const name = ruleOf(
      community,
      '.community__account-head .community__name',
    ).declarations;
    expect(name.get('overflow')).toBe('hidden');
    expect(name.get('text-overflow')).toBe('ellipsis');
    expect(name.get('min-width')).toBe('0');
    expect(value(community, '.community__account-head', 'min-width')).toBe('0');
    expect(
      value(
        community,
        '.community__account-line .community__handle',
        'overflow',
      ),
    ).toBe('hidden');
    // Cancelled, the date goes on under rather than being cut.
    expect(
      value(community, '.is-ending .community__plus-words', 'white-space'),
    ).toBe('normal');
    expect(value(community, '.is-ending .community__plus', 'flex-shrink')).toBe(
      '1',
    );
  });

  it('gives the chevron’s room to the words under a narrow foot', () => {
    expect(value(community, '.community__foot', 'container')).toBe(
      'plus-account/inline-size',
    );
    const narrow = community.filter((rule) =>
      rule.within.some((at) => at.startsWith('@container plus-account')),
    );
    const chevron = narrow.find((rule) =>
      rule.selectors.includes(
        '.community__account .community__account-chevron',
      ),
    );
    expect(chevron?.declarations.get('display')).toBe('none');
    const card = narrow.find((rule) =>
      rule.selectors.includes('.community__account'),
    );
    expect(card?.declarations.get('grid-template-columns')).toBe(
      '36px minmax(0, 1fr)',
    );
  });

  // The maker's tag on the boards stays loud capitals; on the card it is a
  // small tag in the card's own ink.
  it('sets a role beside the name quietly, in the card’s ink', () => {
    const role = ruleOf(
      community,
      '.community__account-head .community__role',
    ).declarations;
    expect(role.get('text-transform')).toBe('none');
    expect(role.get('border')).toBe('0');
    expect(role.get('flex')).toBe('0 0 auto');
    expect(value(community, '.community__role', 'text-transform')).toBe(
      'uppercase',
    );
  });
});
