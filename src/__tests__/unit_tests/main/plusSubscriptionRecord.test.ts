/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  createSubscriptionRecords,
  isSubscriptionRecordFile,
} from '../../../main/account/subscriptionRecord';
import {
  ACCOUNT_ID,
  diskStore,
  DUNE,
  GLOW,
  memoryLogger,
  PLANS,
  type IDisk,
} from '../../utils/plusSubscriptionKit';

// What this computer keeps of Plus, per account, with the credential
// cipher: the claims, Plus's own downloads, the offer made when it ended,
// how its ending is watched, and the plans last heard on sale.

const OFFER = {
  id: 'ending-1',
  at: '2026-11-28T00:00:00.000Z',
  scenes: [{ lookId: GLOW, names: { en: 'Glow', es: 'Brillo' } }],
};

/** The records over `disk`; with no cipher, the store throws on a write as the real one does. */
const over = (disk: IDisk, available = true) => {
  const { lines, logger } = memoryLogger();
  const kept = diskStore(disk, 'plus');
  const store = {
    ...kept,
    available: () => available,
    write: (value: Parameters<typeof kept.write>[0]) => {
      if (!available) {
        throw new Error('Secure credential storage is unavailable.');
      }
      kept.write(value);
    },
  };
  return { records: createSubscriptionRecords({ store, logger }), lines };
};

it('keeps everything across a restart', () => {
  const disk: IDisk = {};
  const { records } = over(disk);
  records.addClaim(ACCOUNT_ID, GLOW);
  records.addDownload(ACCOUNT_ID, GLOW);
  records.addDownload(ACCOUNT_ID, DUNE);
  records.setLapse(ACCOUNT_ID, OFFER);
  records.setWatch(ACCOUNT_ID, { paidUntil: 10, absentSince: 20 });
  records.setKnownPlans(PLANS as never);

  const { records: again } = over(disk);
  expect(again.claimed(ACCOUNT_ID, GLOW)).toBe(true);
  expect(again.downloads(ACCOUNT_ID)).toEqual([GLOW, DUNE]);
  expect(again.lapse(ACCOUNT_ID)).toEqual(OFFER);
  expect(again.watch(ACCOUNT_ID)).toEqual({ paidUntil: 10, absentSince: 20 });
  expect(again.knownPlans()).toEqual(PLANS);
  expect(again.hasDownloads(ACCOUNT_ID)).toBe(true);
});

it('drops only the downloads named, and says when none are left', () => {
  const { records } = over({});
  records.addDownload(ACCOUNT_ID, GLOW);
  records.addDownload(ACCOUNT_ID, DUNE);
  records.dropDownloads(ACCOUNT_ID, [GLOW]);
  expect(records.downloads(ACCOUNT_ID)).toEqual([DUNE]);
  records.dropDownloads(ACCOUNT_ID, [DUNE]);
  expect(records.hasDownloads(ACCOUNT_ID)).toBe(false);
});

it('records a download once, and only a scene’s', () => {
  const { records } = over({});
  records.addDownload(ACCOUNT_ID, GLOW);
  records.addDownload(ACCOUNT_ID, GLOW);
  records.addDownload(ACCOUNT_ID, 'builtin:spectrum');
  expect(records.downloads(ACCOUNT_ID)).toEqual([GLOW]);
});

it('keeps each account’s apart', () => {
  const other = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const { records } = over({});
  records.addDownload(ACCOUNT_ID, GLOW);
  expect(records.downloads(other)).toEqual([]);
  expect(records.claimed(other, GLOW)).toBe(false);
});

it('reads a record that is not one as nothing, which keeps every download', () => {
  expect(isSubscriptionRecordFile({ version: 2, accounts: {} })).toBe(false);
  expect(isSubscriptionRecordFile({ version: 1, accounts: [] })).toBe(false);
  expect(isSubscriptionRecordFile({ version: 1, accounts: {} })).toBe(true);
});

it('leaves out every row it cannot read, and keeps the rest', () => {
  const disk: IDisk = {
    plus: {
      version: 1,
      plans: [PLANS[0], { id: 'weekly' }] as never,
      accounts: {
        [ACCOUNT_ID]: {
          claimed: [GLOW, 7, 'nonsense'],
          downloads: [DUNE, DUNE, null],
          lapse: {
            id: 'x',
            at: 'soon',
            scenes: [],
          },
          watch: { paidUntil: 'later', absentSince: 5 },
        },
        'not-an-account': { claimed: [GLOW], downloads: [GLOW] },
      } as never,
    },
  };
  const { records } = over(disk);
  expect(records.claimed(ACCOUNT_ID, GLOW)).toBe(true);
  expect(records.downloads(ACCOUNT_ID)).toEqual([DUNE]);
  expect(records.lapse(ACCOUNT_ID)).toBeUndefined();
  expect(records.watch(ACCOUNT_ID)).toEqual({ absentSince: 5 });
  expect(records.knownPlans()).toEqual([PLANS[0]]);
  expect(records.downloads('not-an-account')).toEqual([]);
});

it('a lapsed scene without an English name is left out of the offer', () => {
  const disk: IDisk = {
    plus: {
      version: 1,
      accounts: {
        [ACCOUNT_ID]: {
          claimed: [],
          downloads: [],
          lapse: {
            ...OFFER,
            scenes: [
              { lookId: GLOW, names: { es: 'Brillo' } },
              { lookId: DUNE, names: { en: 'Dune' } },
            ],
          },
        },
      } as never,
    },
  };
  expect(over(disk).records.lapse(ACCOUNT_ID)?.scenes).toEqual([
    { lookId: DUNE, names: { en: 'Dune' } },
  ]);
});

it('tells its listeners of each change, and only of a change', () => {
  const { records } = over({});
  const changed = jest.fn();
  records.onChange(changed);
  records.setLapse(ACCOUNT_ID, OFFER);
  records.setLapse(ACCOUNT_ID, undefined);
  records.setLapse(ACCOUNT_ID, undefined);
  expect(changed).toHaveBeenCalledTimes(2);
});

it('waits for the cipher before reading, and keeps this run’s word if it cannot save', () => {
  const disk: IDisk = {};
  over(disk).records.addDownload(ACCOUNT_ID, GLOW);
  const { records, lines } = over(disk, false);
  // Not readable yet: nothing is known, and nothing kept is overwritten.
  expect(records.downloads(ACCOUNT_ID)).toEqual([]);
  records.addClaim(ACCOUNT_ID, DUNE);
  expect(records.claimed(ACCOUNT_ID, DUNE)).toBe(true);
  expect(disk.plus?.accounts[ACCOUNT_ID]?.downloads).toEqual([GLOW]);
  expect(lines).toEqual([
    expect.stringContaining('The Plus record could not be saved'),
  ]);
});
