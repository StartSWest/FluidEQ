/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import en from '../../../common/i18n/en';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import {
  changedSince,
  PLUS_TERMS_CHANGES,
  plusTermsNotice,
  shouldAskAgreedTerms,
  type IPlusTermsNoticeFacts,
} from '../../../common/plusTermsNotice';

/** A member who agreed to version 3, never shown a notice, on version 5. */
const facts = (
  overrides: Partial<IPlusTermsNoticeFacts> = {},
): IPlusTermsNoticeFacts => ({
  termsOffered: true,
  accountId: 'account-a',
  member: true,
  agreed: 3,
  seen: 0,
  current: 5,
  ...overrides,
});

describe('whether a member is told the Plus terms changed', () => {
  // The positive control every "no notice" below is measured against.
  it('tells a member who agreed to an older version, naming what changed since', () => {
    expect(plusTermsNotice(facts())).toEqual({ version: 5, changes: [5, 4] });
  });

  it('tells nobody who has agreed to the current version or a later one', () => {
    expect(plusTermsNotice(facts({ agreed: 5 }))).toBeUndefined();
    expect(plusTermsNotice(facts({ agreed: 6 }))).toBeUndefined();
  });

  it('tells nobody who is not a member, or not signed in', () => {
    expect(plusTermsNotice(facts({ member: false }))).toBeUndefined();
    expect(plusTermsNotice(facts({ accountId: undefined }))).toBeUndefined();
  });

  // Its button opens the terms, and a build that sells nothing has none to
  // open.
  it('tells nobody in a build that does not offer Plus', () => {
    expect(plusTermsNotice(facts({ termsOffered: false }))).toBeUndefined();
  });

  it('tells each version once: a notice put away stays away', () => {
    expect(plusTermsNotice(facts({ seen: 5 }))).toBeUndefined();
    // A notice seen for an older version says nothing about this one.
    expect(plusTermsNotice(facts({ seen: 4 }))).toEqual({
      version: 5,
      changes: [5, 4],
    });
  });

  it('waits for the server rather than guessing at an agreement', () => {
    expect(plusTermsNotice(facts({ agreed: undefined }))).toBeUndefined();
  });

  it('tells a member with no agreement on record only the newest change', () => {
    expect(plusTermsNotice(facts({ agreed: 0 }))).toEqual({
      version: 5,
      changes: [5],
    });
  });
});

describe('when the server is worth asking', () => {
  it('asks for a member whose agreement is not known yet', () => {
    expect(shouldAskAgreedTerms(facts({ agreed: undefined }))).toBe(true);
  });

  it('does not ask again once the answer is known', () => {
    expect(shouldAskAgreedTerms(facts({ agreed: 3 }))).toBe(false);
    expect(shouldAskAgreedTerms(facts({ agreed: 0 }))).toBe(false);
  });

  it('does not ask when no answer could lead to a notice', () => {
    const unknown = { agreed: undefined };
    expect(shouldAskAgreedTerms(facts({ ...unknown, seen: 5 }))).toBe(false);
    expect(shouldAskAgreedTerms(facts({ ...unknown, member: false }))).toBe(
      false,
    );
    expect(
      shouldAskAgreedTerms(facts({ ...unknown, accountId: undefined })),
    ).toBe(false);
    expect(
      shouldAskAgreedTerms(facts({ ...unknown, termsOffered: false })),
    ).toBe(false);
  });
});

describe('the versions a notice names', () => {
  it('names every version after the agreed one, newest first', () => {
    expect(changedSince(2, 5)).toEqual([5, 4, 3]);
    expect(changedSince(4, 5)).toEqual([5]);
  });

  it('names only the newest when nothing was agreed', () => {
    expect(changedSince(0, 5)).toEqual([5]);
  });
});

// Every language carrying every one of these sentences is `i18n.test.ts`'s
// job, which fails on any key a locale is missing.
describe('what each version changed', () => {
  // Raising PLUS_TERMS_VERSION without saying what changed would put a notice
  // on screen with nothing in it.
  it('has a sentence for every version from the second to the current one', () => {
    for (let version = 2; version <= PLUS_TERMS_VERSION; version += 1) {
      const key = PLUS_TERMS_CHANGES[version];
      expect(key).toBe(`termsNotice.change.${version}`);
      expect(en[key].trim()).not.toBe('');
    }
  });
});
