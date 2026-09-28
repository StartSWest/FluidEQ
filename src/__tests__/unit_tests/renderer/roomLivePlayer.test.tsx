/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import type { IHostAnalysisRoom } from 'common/dsp/analysisWire';
import { DSP_DEFAULTS, type IDspSettings } from 'common/dsp/chain';
import type { IEngineOutputHealth } from 'common/engineHealth';
import { resetRackGate, updateRackGate } from 'renderer/dsp/rackPlacement';
import { setDspRoomReport } from 'renderer/dsp/roomTelemetry';
import { roomLiveOfPlayer, useDspPageRoomLive } from 'renderer/dsp/useRoomLive';
import type { IListenedOutput } from 'renderer/utils/useListenedOutput';

/*
 * The Room card's chip while a Library song plays. The rack runs in the
 * Library player then and stands aside in the engine, so the engine's status
 * said "Room off" over a room that was playing, and under Equalizer APO the
 * chip said "Engine only" over the same room.
 */

const rendered: IHostAnalysisRoom = {
  active: true,
  original: false,
  matchAvailable: false,
  referenceGainDb: 0,
  conventionalFoldDown: false,
  positionProtected: false,
  sourceBypassed: false,
};

const withRoom = (
  room: Partial<IDspSettings['room']>,
  enabled = true,
): IDspSettings => ({
  ...DSP_DEFAULTS,
  enabled,
  room: { ...DSP_DEFAULTS.room, enabled: true, ...room },
});

// The engine's own word for the output, with its rack standing aside.
const standingAside: IEngineOutputHealth = {
  endpoint: '{AAAA}',
  locked: true,
  processing: true,
  owner: true,
  problems: [],
  channels: 2,
  room: 'off',
};
const engineSaysOff: IListenedOutput = { known: true, output: standingAside };

describe("the Library player's room, as the chip names it", () => {
  it('is the front stage while it renders: the player is always stereo', () => {
    expect(roomLiveOfPlayer(rendered, withRoom({}))).toEqual({
      state: 'front-stage',
      channels: 2,
    });
  });

  it('is the whole room with the music upmix on', () => {
    expect(roomLiveOfPlayer(rendered, withRoom({ musicUpmix: true }))).toEqual({
      state: 'music',
      channels: 2,
    });
  });

  it('is off with the Room or the whole rack switched off, whatever was last reported', () => {
    expect(roomLiveOfPlayer(rendered, withRoom({ enabled: false })).state).toBe(
      'off',
    );
    expect(roomLiveOfPlayer(rendered, withRoom({}, false)).state).toBe('off');
  });

  it('had no head when the Room is on and renders nothing', () => {
    expect(
      roomLiveOfPlayer({ ...rendered, active: false }, withRoom({})).state,
    ).toBe('no-head');
  });

  it('is not guessed before the player has reported', () => {
    expect(roomLiveOfPlayer(undefined, withRoom({}))).toEqual({
      state: 'unknown',
      channels: undefined,
    });
  });
});

describe("the DSP page's chip", () => {
  beforeEach(() => {
    resetRackGate({ engine: 'fluid', eqLoaded: true });
    setDspRoomReport(rendered);
  });

  afterEach(() => {
    // Inside act: the hook of the case just run is still mounted here, and
    // hears the report go.
    act(() => {
      setDspRoomReport(undefined);
    });
  });

  it("reads the player while the Library plays, not the engine's stood-aside rack", () => {
    act(() => {
      updateRackGate({ libraryAudible: true });
    });
    const { result } = renderHook(() =>
      useDspPageRoomLive(engineSaysOff, withRoom({})),
    );
    expect(result.current.state).toBe('front-stage');
  });

  it('reads the engine the rest of the time', () => {
    const { result } = renderHook(() =>
      useDspPageRoomLive(engineSaysOff, withRoom({})),
    );
    expect(result.current.state).toBe('off');
  });

  it('reads the engine while the rack is off everywhere, Library or not', () => {
    act(() => {
      updateRackGate({ libraryAudible: true, eqEnabled: false });
    });
    const { result } = renderHook(() =>
      useDspPageRoomLive(engineSaysOff, withRoom({})),
    );
    expect(result.current.state).toBe('off');
  });

  it('follows the player as its reports change', () => {
    act(() => {
      updateRackGate({ libraryAudible: true });
    });
    const { result } = renderHook(() =>
      useDspPageRoomLive(engineSaysOff, withRoom({})),
    );
    act(() => {
      setDspRoomReport({ ...rendered, active: false });
    });
    expect(result.current.state).toBe('no-head');
  });

  it('reads the player under Equalizer APO, where there is no engine status', () => {
    act(() => {
      resetRackGate({ engine: 'apo', eqLoaded: true, libraryAudible: true });
    });
    const { result } = renderHook(() =>
      useDspPageRoomLive({ known: false, output: undefined }, withRoom({})),
    );
    expect(result.current.state).toBe('front-stage');
  });
});
