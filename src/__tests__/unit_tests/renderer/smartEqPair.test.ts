/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the Smart EQ pair on the EQ toolbar can be pressed.
 *
 * Every launch used to draw it greyed out for the second the live capture
 * takes to open, with its two halves disagreeing about what greyed out looks
 * like, and then light it — reported as the button starting in the wrong
 * theme. The case that did it is the first one here.
 */
import isSmartEqPairDisabled from '../../../renderer/utils/smartEqPair';

const opening = { isCaptureActive: false, captureError: '' };
const open = { isCaptureActive: true, captureError: '' };
const failed = { isCaptureActive: false, captureError: 'No sound device' };

describe('whether the Smart EQ pair can be pressed', () => {
  describe('in a continuous mode, whose press only flips a setting', () => {
    it('can while the capture is still opening, as every launch starts', () => {
      expect(
        isSmartEqPairDisabled({
          mode: 'target',
          isBalancing: false,
          ...opening,
        }),
      ).toBe(false);
    });

    it('can once the capture is open', () => {
      expect(
        isSmartEqPairDisabled({ mode: 'balance', isBalancing: false, ...open }),
      ).toBe(false);
    });

    it('cannot once the capture has failed to open', () => {
      expect(
        isSmartEqPairDisabled({
          mode: 'detail',
          isBalancing: false,
          ...failed,
        }),
      ).toBe(true);
    });
  });

  describe('for the one-shot measurement, which needs the capture now', () => {
    it('cannot while the capture is not open', () => {
      expect(
        isSmartEqPairDisabled({
          mode: 'smart',
          isBalancing: false,
          ...opening,
        }),
      ).toBe(true);
      expect(
        isSmartEqPairDisabled({ mode: 'smart', isBalancing: false, ...failed }),
      ).toBe(true);
    });

    it('can once it is open', () => {
      expect(
        isSmartEqPairDisabled({ mode: 'smart', isBalancing: false, ...open }),
      ).toBe(false);
    });

    /**
     * While it runs the same button is its Cancel, and a run that has lost
     * its capture is exactly the run somebody needs to be able to stop.
     */
    it('can always be cancelled while it is running', () => {
      expect(
        isSmartEqPairDisabled({ mode: 'smart', isBalancing: true, ...failed }),
      ).toBe(false);
    });
  });
});
