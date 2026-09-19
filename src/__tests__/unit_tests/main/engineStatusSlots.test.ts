/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The slot names travel through four places, and all four have to agree: the
 * helper writes them, main's guard admits them, the ladder walks them, and
 * the app's type names them. The guard is the one that fails quietly.
 *
 * A name it does not admit is dropped, and the endpoint then reads as one
 * whose slot the helper "does not report" — so the repair answers that there
 * is nothing it can move, and the card says nothing more will be tried. That
 * is exactly what happened on a Bluetooth headset the moment three rungs
 * were added to the ladder and this list was not: the engine was moved into
 * one of them, the next read threw the answer away, and the walk stopped one
 * rung in on a machine where five rungs were left.
 *
 * Read through `parseFluidEngineStatus`, from a document shaped like the
 * helper's own, so the test fails for the same reason the machine did.
 */

import { SLOT_LADDER } from 'main/engineOutputRepair';
import { parseFluidEngineStatus } from 'main/engineStatus';

const GUID = '{8C8D5019-FE92-46FD-9AB2-0CFBA72BB986}';

const statusWith = (endpoint: Record<string, unknown>) =>
  parseFluidEngineStatus(
    JSON.stringify({
      installed: true,
      dllVersion: '1.12.0.0',
      endpoints: [
        { guid: GUID, attached: true, backupExists: true, ...endpoint },
      ],
    }),
  ).endpoints[0];

describe('the slot names main will admit', () => {
  it('admits every rung of the ladder, by name', () => {
    SLOT_LADDER.forEach((rung) => {
      expect(statusWith({ slot: rung }).slot).toBe(rung);
    });
  });

  it('drops a name it does not know rather than trusting it', () => {
    // The positive control: the guard is a guard, and a helper newer than
    // this app is a thing that happens. A slot this app cannot reason about
    // must not reach the ladder as though it could.
    expect(statusWith({ slot: 'from-the-future' }).slot).toBeUndefined();
  });

  it('carries the history of what has already been tried', () => {
    expect(
      statusWith({ slot: 'efx-single', slotsTried: ['lfx', 'efx-single'] })
        .slotsTried,
    ).toEqual(['lfx', 'efx-single']);
  });

  it('keeps the readable half of a history it cannot read whole', () => {
    // One rung this app has no name for is one rung it cannot reason about,
    // not a reason to lose the walk and offer the top of the ladder again.
    expect(
      statusWith({ slot: 'lfx', slotsTried: ['efx', 'from-the-future', 'lfx'] })
        .slotsTried,
    ).toEqual(['efx', 'lfx']);
  });

  it('says nothing about a history an older helper does not report', () => {
    expect(statusWith({ slot: 'efx' }).slotsTried).toBeUndefined();
  });
});
