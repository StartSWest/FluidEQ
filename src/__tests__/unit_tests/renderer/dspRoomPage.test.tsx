/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import {
  ROOM_CLASSIC_LIST,
  ROOM_FEATURED_LIST,
  ROOM_PRESET_SHAPES,
  roomPresetSettings,
} from '../../../common/dsp/roomPresets';
import en from '../../../common/i18n/en';
import DspRoomCard from '../../../renderer/dsp/DspRoomCard';
import { forgetRoomSource } from '../../../renderer/dsp/roomProfileMemory';
import { setDspRoomReport } from '../../../renderer/dsp/roomTelemetry';
import { readSavedRooms, saveRoom } from '../../../renderer/dsp/savedRooms';
import type { IRoomLive } from '../../../renderer/dsp/useRoomLive';

let entitled = true;
jest.mock('../../../renderer/plus/GalleryParts', () => ({
  usePlusEntitled: () => entitled,
}));

let chainResult: string | undefined;
jest.mock('../../../renderer/dsp/systemChain', () => ({
  readSystemDspChainResult: () => chainResult,
  subscribeSystemDspChainResult: () => () => undefined,
}));

const on = (next: Partial<IRoomSettings> = {}): IRoomSettings => ({
  ...DSP_DEFAULTS.room,
  enabled: true,
  ...next,
});

/** The card with a room that really changes, as the panel holds it. */
const Page = ({
  start,
  live,
  seen,
}: {
  start: IRoomSettings;
  live: IRoomLive;
  seen: (room: IRoomSettings) => void;
}) => {
  const [room, setRoom] = useState(start);
  return (
    <DspRoomCard
      room={room}
      live={live}
      onPatch={(next) => {
        seen(next);
        setRoom(next);
      }}
      onCommit={() => undefined}
    />
  );
};

const renderPage = (
  start: IRoomSettings = on(),
  live: IRoomLive = { state: '7.1', channels: 8 },
) => {
  const rooms: IRoomSettings[] = [];
  render(<Page start={start} live={live} seen={(room) => rooms.push(room)} />);
  return { last: () => rooms[rooms.length - 1], rooms };
};

const openPicker = () =>
  fireEvent.click(screen.getByRole('button', { name: en['dsp.room.presets'] }));

beforeEach(() => {
  entitled = true;
  chainResult = undefined;
  window.localStorage.clear();
  forgetRoomSource();
  act(() => setDspRoomReport(undefined));
});

describe('the rooms in the picker', () => {
  it('files them under three headings that say what they are', () => {
    saveRoom('Den', on({ walls: 0.2 }));
    renderPage();
    openPicker();
    expect(screen.getByText(en['dsp.room.featured'])).toBeInTheDocument();
    expect(screen.getByText(en['dsp.room.classicRooms'])).toBeInTheDocument();
    expect(screen.getByText(en['dsp.eqPreset.saved'])).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(
      ROOM_FEATURED_LIST.length + ROOM_CLASSIC_LIST.length + 1,
    );
  });

  it('applies a featured room whole, switches the room on, and says what it is for', () => {
    const { last } = renderPage({ ...on(), enabled: false, head: 'small' });
    openPicker();
    fireEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(en['dsp.room.profile.liveVenueV2']),
      }),
    );
    expect(last()).toMatchObject({
      presetId: 'liveVenueV2',
      enabled: true,
      head: 'small',
      rendererVersion: 2,
      ambienceMix: ROOM_PRESET_SHAPES.liveVenueV2.ambienceMix,
    });
    expect(
      screen.getByRole('button', { name: en['dsp.room.presets'] }),
    ).toHaveTextContent(en['dsp.room.profile.liveVenueV2']);
  });

  it('walks featured rooms into classic ones with the arrows', () => {
    // The last featured room, whichever it is: the next step is a classic.
    const lastFeatured = ROOM_FEATURED_LIST[ROOM_FEATURED_LIST.length - 1].id;
    const { last } = renderPage(roomPresetSettings(on(), lastFeatured));
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqPreset.next'] }),
    );
    expect(last().presetId).toBe(ROOM_CLASSIC_LIST[0].id);
  });

  it('stands in a saved room by its name, and offers to delete it', () => {
    saveRoom('Den', on({ walls: 0.2 }));
    const { last } = renderPage();
    openPicker();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Den/ }));
    expect(last()).toMatchObject({ presetId: 'custom', walls: 0.2 });
    expect(
      screen.getByRole('button', { name: en['dsp.room.presets'] }),
    ).toHaveTextContent('Den');
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqSave.delete'] }),
    );
    expect(readSavedRooms()).toEqual([]);
  });
});

describe('Restore and Reset', () => {
  it('offers Restore only once a room has been edited, and puts that room back', () => {
    const { last } = renderPage(
      roomPresetSettings(on({ head: 'large' }), 'cinemaV2'),
    );
    expect(
      screen.queryByRole('button', { name: en['dsp.room.restore'] }),
    ).not.toBeInTheDocument();
    const quick = within(
      screen.getByRole('group', { name: en['dsp.room.quick.title'] }),
    );
    fireEvent.change(quick.getByLabelText(en['dsp.room.quick.ambience']), {
      target: { value: '0.2' },
    });
    expect(last().presetId).toBe('custom');
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.room.restore'] }),
    );
    expect(last()).toMatchObject({
      presetId: 'cinemaV2',
      ambienceMix: ROOM_PRESET_SHAPES.cinemaV2.ambienceMix,
      head: 'large',
    });
  });

  it('offers no Restore for a custom room nobody remembers making', () => {
    renderPage(on({ presetId: 'custom', sizeM: 7 }));
    expect(
      screen.queryByRole('button', { name: en['dsp.room.restore'] }),
    ).not.toBeInTheDocument();
  });

  it('resets to the Reference room as it ships, the listener included, and leaves the power switch', () => {
    const { last } = renderPage(
      roomPresetSettings(
        on({ head: 'large', sourceAlreadySpatial: true }),
        'cinemaV2',
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqPreset.reset'] }),
    );
    // The Reference room and not the rack's default, which is the classic
    // living room on the renderer without Space or Ambience.
    expect(last()).toEqual({
      ...roomPresetSettings(DSP_DEFAULTS.room, 'referenceV2'),
      enabled: true,
    });
    expect(last()).toMatchObject({
      presetId: 'referenceV2',
      rendererVersion: 2,
      head: DSP_DEFAULTS.room.head,
      sourceAlreadySpatial: false,
    });
  });
});

describe('saving a room from the bar', () => {
  const saveAs = (name: string) => {
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqSave.save'] }),
    );
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText(en['dsp.room.savePlaceholder']), {
      target: { value: name },
    });
    return dialog;
  };

  it('says which name a taken one will become, keeps both, and reports the name it got', () => {
    saveRoom('Den', on({ walls: 0.2 }));
    renderPage(on({ walls: 0.7, presetId: 'custom' }));
    const dialog = saveAs('den');
    expect(
      dialog.getByText(
        en['dsp.room.saveKeepsBoth'].replace('{name}', 'den (2)'),
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      dialog.getByRole('button', { name: en['dsp.eqSave.save'] }),
    );
    expect(
      readSavedRooms().map((room) => [room.name, room.shape.walls]),
    ).toEqual([
      ['Den', 0.2],
      ['den (2)', 0.7],
    ]);
    expect(
      screen.getByText(en['dsp.eqSave.saved'].replace('{name}', 'den (2)')),
    ).toBeInTheDocument();
  });

  it('does not announce a save that storage refused', () => {
    renderPage(on({ walls: 0.7, presetId: 'custom' }));
    const dialog = saveAs('Den');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    fireEvent.click(
      dialog.getByRole('button', { name: en['dsp.eqSave.save'] }),
    );
    jest.restoreAllMocks();
    expect(screen.getByText(en['dsp.room.saveFailed'])).toBeInTheDocument();
    expect(readSavedRooms()).toEqual([]);
  });

  // Saving a room was Plus until 2026-09-20. Plus is the visualizers and
  // what the server does for them; a room lives in this window.
  it('is offered to everybody', () => {
    entitled = false;
    renderPage();
    expect(
      screen.getByRole('button', { name: en['dsp.eqSave.save'] }),
    ).toBeEnabled();
  });
});

describe('a classic room and the new sound', () => {
  it('draws no Space or Ambience on a classic room, and moves it only on the press', () => {
    const { last, rooms } = renderPage(roomPresetSettings(on(), 'club'));
    expect(
      screen.queryByLabelText(en['dsp.room.quick.space']),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(en['dsp.room.quick.ambience']),
    ).not.toBeInTheDocument();
    // Looking at it changed nothing.
    expect(rooms).toHaveLength(0);
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.room.classic.upgrade'] }),
    );
    expect(last()).toMatchObject({
      presetId: 'custom',
      rendererVersion: 2,
      subDb: ROOM_PRESET_SHAPES.club.subDb,
    });
    expect(screen.getByLabelText(en['dsp.room.quick.space'])).toBeEnabled();
  });

  it('rests Ambience while Space is at nothing: a tail needs walls to follow', () => {
    renderPage(roomPresetSettings(on(), 'competitiveV2'));
    expect(screen.getByLabelText(en['dsp.room.quick.ambience'])).toBeDisabled();
    expect(screen.getByLabelText(en['dsp.room.quick.space'])).toBeEnabled();
  });
});

describe('what is playing, truthfully', () => {
  it('rests the Sub on expanded stereo, which has no subwoofer channel, and says so', () => {
    renderPage(roomPresetSettings(on(), 'cinemaV2'), {
      state: 'music',
      channels: 2,
    });
    expect(screen.getByLabelText(en['dsp.room.sub'])).toBeDisabled();
    // The centre is worked out from the pair, so its dial has something to turn.
    expect(screen.getByLabelText(en['dsp.room.centre'])).toBeEnabled();
    expect(
      screen.getByText(new RegExp(en['dsp.room.tune.noSubChannel'])),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-derived'),
    ).toHaveLength(5);
  });

  it('says the engine is too old for the room, from the engine and not from a guess', () => {
    chainResult = 'update-required';
    renderPage(roomPresetSettings(on(), 'cinemaV2'));
    expect(
      screen.getByText(en['dsp.room.signal.updateRequired']),
    ).toBeInTheDocument();
  });
});

describe('what came off the page', () => {
  it('offers no comparison and no already-spatial switch: each was the power switch by another name', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /compare/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /spatial/i })).toBeNull();
  });
});
