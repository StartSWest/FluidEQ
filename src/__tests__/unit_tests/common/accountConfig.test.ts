/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  buildAccountConfig,
  isAccountConfigured,
  isCheckoutConfigured,
} from '../../../common/accountConfig';

const URL_OK = 'https://abcdefghijklm.supabase.co';
const KEY_OK = `sb_publishable_${'a'.repeat(40)}`;

const valid = {
  FLUIDEQ_SUPABASE_URL: URL_OK,
  FLUIDEQ_SUPABASE_ANON_KEY: KEY_OK,
};

const OFF = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  apiUrl: '',
  plusPrice: '',
  plusYearlyPrice: '',
};

describe('account backend configuration', () => {
  // The positive control. Every other case here asserts that something is
  // refused, and without this one a `buildAccountConfig` that returned nothing
  // for every input would pass the entire file.
  it('accepts a well-formed pair and points the API at the project by default', () => {
    expect(buildAccountConfig(valid)).toEqual({
      supabaseUrl: URL_OK,
      supabaseAnonKey: KEY_OK,
      apiUrl: `${URL_OK}/functions/v1`,
      plusPrice: '',
      plusYearlyPrice: '',
    });
    expect(isAccountConfigured(buildAccountConfig(valid))).toBe(true);
    // Accounts without anything to buy is a whole state, not a half-configured one.
    expect(isCheckoutConfigured(buildAccountConfig(valid))).toBe(false);
  });

  /** The one line that changes when the functions move under the product's domain. */
  it('takes a separate API base, with its path and without a trailing slash', () => {
    expect(
      buildAccountConfig({
        ...valid,
        FLUIDEQ_API_URL: 'https://fluideq.com/api/',
      }).apiUrl,
    ).toBe('https://fluideq.com/api');
  });

  it.each([
    ['plaintext http', 'http://fluideq.com/api'],
    ['a query string', 'https://fluideq.com/api?x=1'],
    ['a fragment', 'https://fluideq.com/api#x'],
    ['not a URL', 'fluideq.com/api'],
  ])('falls back to the project when the API base is %s', (_label, value) => {
    expect(
      buildAccountConfig({ ...valid, FLUIDEQ_API_URL: value }).apiUrl,
    ).toBe(`${URL_OK}/functions/v1`);
  });

  it('offers the upgrade once a price is given, trimmed', () => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_PLUS_PRICE: ' $3.99 / month ',
    });
    expect(config.plusPrice).toBe('$3.99 / month');
    expect(isCheckoutConfigured(config)).toBe(true);
  });

  it('offers a yearly plan beside the monthly one, trimmed', () => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_PLUS_PRICE: '$5',
      FLUIDEQ_PLUS_PRICE_YEARLY: ' $40 ',
    });
    expect(config.plusPrice).toBe('$5');
    expect(config.plusYearlyPrice).toBe('$40');
  });

  /** The monthly price is the switch; a yearly one alone sells nothing. */
  it('ignores a yearly price when there is no monthly one', () => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_PLUS_PRICE_YEARLY: '$40',
    });
    expect(config.plusYearlyPrice).toBe('');
    expect(isCheckoutConfigured(config)).toBe(false);
  });

  /** A price is a short line beside a button, not a paragraph. */
  it('drops a price that is too long to be one', () => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_PLUS_PRICE: 'x'.repeat(41),
    });
    expect(config.plusPrice).toBe('');
    expect(isCheckoutConfigured(config)).toBe(false);
    expect(
      buildAccountConfig({
        ...valid,
        FLUIDEQ_PLUS_PRICE: '$5',
        FLUIDEQ_PLUS_PRICE_YEARLY: 'x'.repeat(41),
      }).plusYearlyPrice,
    ).toBe('');
  });

  it('offers no checkout when the account pair is incomplete', () => {
    const config = buildAccountConfig({ FLUIDEQ_PLUS_PRICE: '$3.99' });
    expect(isCheckoutConfigured(config)).toBe(false);
    expect(config).toEqual(OFF);
  });

  it('is off entirely when nothing is set', () => {
    expect(isAccountConfigured(buildAccountConfig({}))).toBe(false);
  });

  /**
   * One of two would put a sign-in button in the menu that cannot complete,
   * which is worse than no button at all.
   */
  it.each(['FLUIDEQ_SUPABASE_URL', 'FLUIDEQ_SUPABASE_ANON_KEY'])(
    'is off entirely when %s alone is missing',
    (missing) => {
      const partial = { ...valid, [missing]: undefined };
      expect(isAccountConfigured(buildAccountConfig(partial))).toBe(false);
      expect(buildAccountConfig(partial)).toEqual(OFF);
    },
  );

  /**
   * The key guard is the one that matters most here.
   *
   * A legacy anon JWT and a service-role JWT are indistinguishable from the
   * outside, and a service-role key bypasses every row-level security policy in
   * the database — while this value is inlined into both bundles and ships to
   * every user. The whole ambiguous shape is refused rather than inspected.
   */
  it.each([
    ['a service key by prefix', `sb_secret_${'a'.repeat(40)}`],
    ['a personal access token', `sbp_${'a'.repeat(40)}`],
    [
      'a legacy anon JWT',
      `eyJhbGciOiJIUzI1NiJ9.${'a'.repeat(40)}.${'b'.repeat(43)}`,
    ],
    [
      'a legacy service-role JWT',
      `eyJzZXJ2aWNlIjoxfQ.${'c'.repeat(40)}.${'d'.repeat(43)}`,
    ],
    ['something too short', 'sb_publishable_abc'],
    ['a pasted URL', 'https://example.com/key'],
    ['an empty string', ''],
  ])('refuses %s as the publishable key', (_label, key) => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_SUPABASE_ANON_KEY: key,
    });
    expect(isAccountConfigured(config)).toBe(false);
  });

  /**
   * A path is rejected rather than trimmed. The URL is joined with a known
   * path later, so quietly discarding the half somebody typed would produce a
   * build that talks to the wrong endpoint — a worse failure than no accounts.
   */
  it.each([
    ['plaintext http', 'http://abcdefghijklm.supabase.co'],
    ['a path', 'https://abcdefghijklm.supabase.co/rest/v1'],
    ['a query string', 'https://abcdefghijklm.supabase.co/?x=1'],
    ['a fragment', 'https://abcdefghijklm.supabase.co/#x'],
    ['not a URL at all', 'abcdefghijklm.supabase.co'],
    ['an empty string', ''],
  ])('refuses %s as the project URL', (_label, url) => {
    const config = buildAccountConfig({
      ...valid,
      FLUIDEQ_SUPABASE_URL: url,
    });
    expect(isAccountConfigured(config)).toBe(false);
  });

  it('accepts a bare origin written with a trailing slash', () => {
    expect(
      buildAccountConfig({ ...valid, FLUIDEQ_SUPABASE_URL: `${URL_OK}/` })
        .supabaseUrl,
    ).toBe(URL_OK);
  });

  it('trims surrounding whitespace rather than refusing the value', () => {
    expect(
      buildAccountConfig({
        ...valid,
        FLUIDEQ_SUPABASE_ANON_KEY: `  ${KEY_OK}  `,
      }).supabaseAnonKey,
    ).toBe(KEY_OK);
  });
});
