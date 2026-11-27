/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart correction has one way of correcting, Balance (Ivan, 2026-11-27:
 * "we agreed a while ago to remove the modes and default to Balance"). What a
 * window stored under the four ways must come back as Balance and never fail:
 * the stored choice is let go of (`continuousEq.ts`), Balance's presence lines
 * are kept and the other ways' dropped (`presenceThreshold.ts`).
 *
 * Both are read when their module loads, so each case loads them afresh over
 * what it stored.
 */

import * as React from 'react';
import { renderHook } from '@testing-library/react';

type TContinuous = typeof import('renderer/utils/continuousEq');
type TPresence = typeof import('renderer/utils/presenceThreshold');

const load = (stored: Record<string, string>) => {
  window.localStorage.clear();
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let continuous: TContinuous | undefined;
  let presence: TPresence | undefined;
  jest.isolateModules(() => {
    // One React for the window and the store, or its hook is another copy's.
    jest.doMock('react', () => React);
    continuous = jest.requireActual<TContinuous>('renderer/utils/continuousEq');
    presence = jest.requireActual<TPresence>(
      'renderer/utils/presenceThreshold',
    );
  });
  return {
    continuous: continuous as TContinuous,
    presence: presence as TPresence,
  };
};

/** Whether Smart correction is on, as its switch reads it. */
const isOn = ({ continuous }: { continuous: TContinuous }) =>
  renderHook(() => continuous.useContinuousEq()).result.current;

const BASS_HZ = 100;

afterEach(() => {
  window.localStorage.clear();
});

describe('a window that stored one of the four ways', () => {
  it('comes back on Balance from Detail, still running, the choice let go of', () => {
    const loaded = load({
      'fluideq.smartEqMode': 'detail',
      'fluideq.continuousEq': 'true',
    });

    expect(isOn(loaded)).toBe(true);
    expect(window.localStorage.getItem('fluideq.smartEqMode')).toBeNull();
  });

  it('keeps Balance’s presence lines and drops Detail’s and Target’s', () => {
    const { presence } = load({
      'fluideq.smartEqMode': 'detail',
      'fluideq.presenceOffsets': JSON.stringify({
        'detail:bass:floor': -5,
        'balance:bass:floor': 3,
        'target:bass:full': 2,
      }),
    });
    const automatic = (edge: 'floor' | 'full') =>
      presence.defaultThresholdDb(edge, BASS_HZ);

    // Balance's own drag, carried over...
    expect(presence.getPresenceLine('floor', 'bass', BASS_HZ)).toBeCloseTo(
      automatic('floor') + 3,
      6,
    );
    // ...and nothing from the others: Target's would have moved this one.
    expect(presence.getPresenceLine('full', 'bass', BASS_HZ)).toBeCloseTo(
      automatic('full'),
      6,
    );
    expect(presence.hasCustomPresenceRange('bass')).toBe(true);
  });

  it('control: lines stored without a way are read as they are', () => {
    const { presence } = load({
      'fluideq.presenceOffsets': JSON.stringify({ 'bass:full': -2 }),
    });
    expect(presence.getPresenceLine('full', 'bass', BASS_HZ)).toBeCloseTo(
      presence.defaultThresholdDb('full', BASS_HZ) - 2,
      6,
    );
  });

  it('comes back not running from the one-shot, which never ran on its own', () => {
    const loaded = load({
      'fluideq.smartEqMode': 'smart',
      'fluideq.continuousEq': 'true',
    });

    expect(isOn(loaded)).toBe(false);
    expect(window.localStorage.getItem('fluideq.smartEqMode')).toBeNull();
  });

  it('control: with no way stored, the switch is read as it was left', () => {
    expect(isOn(load({ 'fluideq.continuousEq': 'true' }))).toBe(true);
    expect(isOn(load({ 'fluideq.continuousEq': 'false' }))).toBe(false);
  });
});
