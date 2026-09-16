/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's account deletion, as its rows arrive from the server
 * (`admin_find_account`, premium migration 0031): what reads as an account,
 * and what does not.
 */

import {
  accountAddress,
  isAccountAddress,
  parseAccountRow,
} from '../../../common/accountDeletion';

const row = (over: Record<string, unknown> = {}) => ({
  user_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
  email: 'Marisol@Example.com',
  created_at: '2026-03-01T12:00:00+00:00',
  confirmed: true,
  admin: false,
  handle: 'marisol_fc',
  display_name: 'Marisol',
  plan: 'plus',
  plus_until: '2026-10-02T00:00:00+00:00',
  published: 6,
  board_days: 41,
  likes: 128,
  adds: 17,
  reports: 0,
  gifted: true,
  deleting: false,
  ...over,
});

describe('an account row', () => {
  it('reads everything the admin is shown before deleting', () => {
    expect(parseAccountRow(row())).toEqual({
      userId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
      email: 'Marisol@Example.com',
      createdAt: Date.parse('2026-03-01T12:00:00Z'),
      confirmed: true,
      admin: false,
      handle: 'marisol_fc',
      displayName: 'Marisol',
      plan: 'plus',
      plusUntil: Date.parse('2026-10-02T00:00:00Z'),
      published: 6,
      boardDays: 41,
      likes: 128,
      adds: 17,
      reports: 0,
      gifted: true,
      deleting: false,
    });
  });

  it('reads an unfinished deletion whose account is already gone', () => {
    expect(
      parseAccountRow(
        row({
          created_at: null,
          confirmed: false,
          handle: null,
          display_name: null,
          plan: null,
          plus_until: null,
          published: 0,
          board_days: 0,
          likes: 0,
          adds: 0,
          reports: 0,
          gifted: false,
          deleting: true,
        }),
      ),
    ).toEqual({
      userId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
      email: 'Marisol@Example.com',
      confirmed: false,
      admin: false,
      published: 0,
      boardDays: 0,
      likes: 0,
      adds: 0,
      reports: 0,
      gifted: false,
      deleting: true,
    });
  });

  it('shows a plan only while Plus is running', () => {
    const lapsed = parseAccountRow(row({ plus_until: null }));
    expect(lapsed).toBeDefined();
    expect(lapsed?.plan).toBeUndefined();
    expect(lapsed?.plusUntil).toBeUndefined();
  });

  it.each([
    ['an id that is not one', { user_id: 'someone' }],
    ['a missing address', { email: undefined }],
    ['a count that is not a whole number', { likes: 1.5 }],
    ['a negative count', { published: -1 }],
    ['a count sent as text', { board_days: '41' }],
    ['a date that is not one', { created_at: 'yesterday' }],
    ['an end that is not a date', { plus_until: 42 }],
    ['an admin flag that is not a boolean', { admin: 'false' }],
    ['no deleting flag', { deleting: undefined }],
  ])('is nothing with %s', (_label, over) => {
    expect(parseAccountRow(row(over))).toBeUndefined();
  });

  it('reads the FluidEQ and the last sign-in when the list sends them', () => {
    expect(
      parseAccountRow(
        row({
          app_version: '1.7.2',
          seen_at: '2026-09-15T21:30:00+00:00',
        }),
      ),
    ).toMatchObject({
      appVersion: '1.7.2',
      seenAt: Date.parse('2026-09-15T21:30:00+00:00'),
    });
  });

  it('keeps the account when the server says nothing about either', () => {
    // A server that has not been migrated sends neither column, and every
    // other page reading these rows must still get its account.
    const found = parseAccountRow(row());
    expect(found?.email).toBe('Marisol@Example.com');
    expect(found?.appVersion).toBeUndefined();
    expect(found?.seenAt).toBeUndefined();

    // Nulls, which is what an account with no session answers.
    const never = parseAccountRow(row({ app_version: null, seen_at: null }));
    expect(never?.email).toBe('Marisol@Example.com');
    expect(never?.appVersion).toBeUndefined();
    expect(never?.seenAt).toBeUndefined();
  });

  it('is nothing for what is not a row at all', () => {
    expect(parseAccountRow(null)).toBeUndefined();
    expect(parseAccountRow([row()])).toBeUndefined();
    expect(parseAccountRow('row')).toBeUndefined();
  });
});

describe('an address', () => {
  it('is compared trimmed and lowercased, and must be a whole address', () => {
    expect(accountAddress('  Marisol@Example.COM ')).toBe(
      'marisol@example.com',
    );
    expect(isAccountAddress(' a@b.co ')).toBe(true);
    expect(isAccountAddress('marisol')).toBe(false);
    expect(isAccountAddress('a@b')).toBe(false);
    expect(isAccountAddress(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });
});
