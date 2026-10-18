/**
 * Why a free trial ended without Plus (premium 0054), as the app reads and
 * sends it, and the admin's joined window: the shapes on their way between
 * the server and the page, which refuse anything they do not recognise.
 */

import { parseAccountRow } from '../../../common/accountDeletion';
import {
  joinedSince,
  parseAccountListPage,
  readAccountListRequest,
} from '../../../common/adminAccounts';
import {
  MAX_TRIAL_EXIT_NOTE,
  parseTrialExitCounts,
  parseTrialExitStatus,
  readTrialExitAnswer,
} from '../../../common/trialExit';

const ROW = {
  user_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
  email: 'gone@example.com',
  created_at: '2026-10-01T12:00:00Z',
  confirmed: true,
  admin: false,
  gifted: false,
  deleting: false,
  plus_until: null,
  published: 0,
  board_days: 2,
  likes: 0,
  adds: 1,
  reports: 0,
  listed_count: 1,
};

describe('what a member is asked', () => {
  it('reads asked and an answer, and refuses a reason the app does not know', () => {
    expect(parseTrialExitStatus([{ asked: true, reason: null }])).toEqual({
      asked: true,
    });
    expect(parseTrialExitStatus([{ asked: false, reason: 'price' }])).toEqual({
      asked: false,
      reason: 'price',
    });
    expect(
      parseTrialExitStatus([{ asked: true, reason: 'because' }]),
    ).toBeUndefined();
    expect(parseTrialExitStatus([{ reason: null }])).toBeUndefined();
    expect(parseTrialExitStatus([])).toBeUndefined();
  });

  it('sends a known reason with its note trimmed, and an empty note as none', () => {
    expect(readTrialExitAnswer('price', '  Too much  ')).toEqual({
      reason: 'price',
      note: 'Too much',
    });
    expect(readTrialExitAnswer('other', '   ')).toEqual({ reason: 'other' });
    expect(readTrialExitAnswer('other', undefined)).toEqual({
      reason: 'other',
    });
  });

  it('refuses an unknown reason, a note that is not text, and one too long', () => {
    expect(readTrialExitAnswer('because', undefined)).toBeUndefined();
    expect(readTrialExitAnswer('price', 42)).toBeUndefined();
    expect(
      readTrialExitAnswer('price', 'x'.repeat(MAX_TRIAL_EXIT_NOTE + 1)),
    ).toBeUndefined();
    expect(
      readTrialExitAnswer('price', 'x'.repeat(MAX_TRIAL_EXIT_NOTE)),
    ).toEqual({ reason: 'price', note: 'x'.repeat(MAX_TRIAL_EXIT_NOTE) });
  });

  it('reads the breakdown whole or not at all', () => {
    expect(
      parseTrialExitCounts([
        { reason: 'price', answers: 4 },
        { reason: 'none', answers: 2 },
      ]),
    ).toEqual([
      { reason: 'price', answers: 4 },
      { reason: 'none', answers: 2 },
    ]);
    expect(
      parseTrialExitCounts([
        { reason: 'price', answers: 4 },
        { reason: 'because', answers: 1 },
      ]),
    ).toBeUndefined();
    expect(
      parseTrialExitCounts([{ reason: 'price', answers: -1 }]),
    ).toBeUndefined();
    expect(parseTrialExitCounts({})).toBeUndefined();
  });
});

describe('when a joined window begins, on this computer', () => {
  // Friday 16 October 2026, mid-afternoon, local time.
  const friday = new Date(2026, 9, 16, 15, 30);

  it('starts today at midnight, the week on Monday, the month on the 1st', () => {
    expect(joinedSince('ever', friday)).toBeUndefined();
    expect(joinedSince('today', friday)).toBe(new Date(2026, 9, 16).getTime());
    expect(joinedSince('week', friday)).toBe(new Date(2026, 9, 12).getTime());
    expect(joinedSince('month', friday)).toBe(new Date(2026, 9, 1).getTime());
  });

  it('counts a Sunday in the week that began the Monday before', () => {
    const sunday = new Date(2026, 9, 18, 9, 0);
    expect(joinedSince('week', sunday)).toBe(new Date(2026, 9, 12).getTime());
    const monday = new Date(2026, 9, 12, 0, 5);
    expect(joinedSince('week', monday)).toBe(new Date(2026, 9, 12).getTime());
  });
});

describe('the account list request', () => {
  it('takes the lapsed filter and a window, and passes no window as none', () => {
    const since = Date.now() - 86_400_000;
    expect(
      readAccountListRequest({
        query: ' a ',
        plan: 'lapsed',
        offset: 0,
        since,
      }),
    ).toEqual({ query: 'a', plan: 'lapsed', offset: 0, since });
    expect(
      readAccountListRequest({ query: '', plan: 'all', offset: 50 }),
    ).toEqual({ query: '', plan: 'all', offset: 50 });
  });

  it('refuses a window that is not a time, from before accounts, or far ahead', () => {
    const ask = { query: '', plan: 'all', offset: 0 };
    expect(readAccountListRequest({ ...ask, since: 'today' })).toBeUndefined();
    expect(
      readAccountListRequest({ ...ask, since: Number.NaN }),
    ).toBeUndefined();
    expect(
      readAccountListRequest({ ...ask, since: Date.UTC(2020, 0, 1) }),
    ).toBeUndefined();
    expect(
      readAccountListRequest({ ...ask, since: Date.now() + 3 * 86_400_000 }),
    ).toBeUndefined();
    expect(readAccountListRequest({ ...ask, plan: 'gone' })).toBeUndefined();
  });
});

describe('an account row and a page from a server with 0054', () => {
  it('reads when the trial ended and what the member answered', () => {
    const row = parseAccountRow({
      ...ROW,
      trial_ended_at: '2026-10-13T08:00:00Z',
      exit_reason: 'price',
      exit_note: 'A yearly price would help.',
    });
    expect(row).toMatchObject({
      trialEndedAt: Date.parse('2026-10-13T08:00:00Z'),
      exitReason: 'price',
      exitNote: 'A yearly price would help.',
    });
  });

  it('keeps the row, without them, from a server before it or with garbage', () => {
    const before = parseAccountRow(ROW);
    expect(before).toBeDefined();
    expect(before).not.toHaveProperty('trialEndedAt');
    expect(before).not.toHaveProperty('exitReason');
    const odd = parseAccountRow({ ...ROW, exit_reason: 'because' });
    expect(odd).toBeDefined();
    expect(odd).not.toHaveProperty('exitReason');
  });

  it('reads the lapsed count, and has none from a server before it', () => {
    const totals = [{ matched: 3, paying: 1, lapsed: 2 }];
    expect(parseAccountListPage([ROW], totals)?.lapsed).toBe(2);
    expect(
      parseAccountListPage([ROW], [{ matched: 3, paying: 1 }]),
    ).not.toHaveProperty('lapsed');
  });
});
