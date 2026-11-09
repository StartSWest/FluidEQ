/**
 * When a scene whose GPU context was lost may come back (`sceneLosses.ts`):
 * from every reset that was not its own doing, as long as it draws between
 * them; never from a run of them it caused.
 */
import { createSceneLossLedger } from '../../../renderer/graph/sceneLosses';

const NOT_ITS_FAULT = { heavy: false, scenesOwn: false };

it('comes back from a reset of the driver every time it draws in between', () => {
  const ledger = createSceneLossLedger();
  // Sleep, a driver update, another page's crash: hours apart, many times.
  for (let night = 0; night < 5; night += 1) {
    expect(ledger.lost(NOT_ITS_FAULT)).toBe(false);
    ledger.restored();
    ledger.drew();
  }
  expect(ledger.spent()).toBe(false);
});

// The control for the case above, and the rule that stays: a driver that
// goes again before the scene has drawn a frame is not coming back.
it('is done for when lost again before a frame came back', () => {
  const ledger = createSceneLossLedger();
  ledger.lost(NOT_ITS_FAULT);
  ledger.restored();
  expect(ledger.lost(NOT_ITS_FAULT)).toBe(true);
  expect(ledger.spent()).toBe(true);
});

it('never forgets a loss that was its own doing', () => {
  const ledger = createSceneLossLedger();
  ledger.lost({ heavy: false, scenesOwn: true });
  ledger.restored();
  ledger.drew();
  expect(ledger.lost({ heavy: false, scenesOwn: true })).toBe(true);
});

it('does not come back at all from a heavy frame nobody has watched', () => {
  const ledger = createSceneLossLedger();
  expect(ledger.lost({ heavy: true, scenesOwn: true })).toBe(true);
  expect(ledger.spent()).toBe(true);
});

it('counts a frame drawn before any loss as nothing to forgive', () => {
  const ledger = createSceneLossLedger();
  ledger.drew();
  ledger.lost(NOT_ITS_FAULT);
  // Drawn, but never restored: the loss still stands.
  ledger.drew();
  expect(ledger.lost(NOT_ITS_FAULT)).toBe(true);
});
