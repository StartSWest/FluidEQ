/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import {
  ROOM_PRESET_LIST,
  ROOM_PRESET_SHAPES,
  roomPresetSettings,
} from '../../../common/dsp/roomPresets';
import en from '../../../common/i18n/en';
import DspRoomCard from '../../../renderer/dsp/DspRoomCard';
import type { IRoomLive } from '../../../renderer/dsp/useRoomLive';

let entitled = true;
jest.mock('../../../renderer/plus/GalleryParts', () => ({
  usePlusEntitled: () => entitled,
}));

const renderCard = (
  room: IRoomSettings = { ...DSP_DEFAULTS.room, enabled: true },
  live: IRoomLive = { state: '7.1', channels: 8 },
) => {
  const onPatch = jest.fn();
  const onCommit = jest.fn();
  render(
    <DspRoomCard
      room={room}
      live={live}
      onPatch={onPatch}
      onCommit={onCommit}
    />,
  );
  return { onPatch, onCommit };
};

describe('the Room card', () => {
  beforeEach(() => {
    entitled = true;
  });

  it('shows the room from above with every speaker, and what the room is doing', () => {
    renderCard();
    expect(
      screen.getByRole('img', { name: en['dsp.room.graphLabel'] }),
    ).toBeInTheDocument();
    ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'].forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.getByText(en['dsp.room.live.sevenOne'])).toHaveClass('is-on');
  });

  it('offers the rooms in the header picker, applies one whole and keeps the head', () => {
    const { onPatch, onCommit } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      head: 'large',
    });
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.room.presets'] }),
    );
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(
      ROOM_PRESET_LIST.length,
    );
    fireEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(en['dsp.room.preset.cinema']),
      }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'cinema',
        sizeM: ROOM_PRESET_SHAPES.cinema.sizeM,
        subDb: ROOM_PRESET_SHAPES.cinema.subDb,
        head: 'large',
        enabled: true,
      }),
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('reads Custom in the picker once the room is shaped, and Reset puts the living room back', () => {
    const { onPatch } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      presetId: 'custom',
      sizeM: 7,
    });
    expect(
      screen.getByRole('button', { name: en['dsp.room.presets'] }),
    ).toHaveTextContent(en['dsp.eqPreset.custom']);
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqPreset.reset'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'livingRoom',
        sizeM: ROOM_PRESET_SHAPES.livingRoom.sizeM,
      }),
    );
  });

  it('steps to the next room with the arrow', () => {
    const { onPatch } = renderCard();
    const current = ROOM_PRESET_LIST.findIndex(
      (preset) => preset.id === DSP_DEFAULTS.room.presetId,
    );
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqPreset.next'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: ROOM_PRESET_LIST[current + 1].id }),
    );
  });

  it('makes the room custom when a dial moves', () => {
    const { onPatch } = renderCard();
    // The knob's input is a position along its own travel, not the metres;
    // any travel is a change of size and the end of the preset's name.
    const size = screen.getByLabelText(en['dsp.room.size']);
    fireEvent.change(size, { target: { value: '6' } });
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: 'custom' }),
    );
    const [[patched]] = onPatch.mock.calls as [[IRoomSettings]];
    expect(patched.sizeM).not.toBe(DSP_DEFAULTS.room.sizeM);
  });

  it('locks the dials and the drag without Plus, and says so, but not the presets or the head', () => {
    entitled = false;
    const { onPatch } = renderCard();
    expect(screen.getByLabelText(en['dsp.room.size'])).toBeDisabled();
    expect(screen.getByText(en['dsp.room.plusHint'])).toBeInTheDocument();
    expect(screen.getByText(en['dsp.room.plusDragHint'])).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.room.presets'] }),
    );
    fireEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(en['dsp.room.preset.studio']),
      }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: 'studio' }),
    );
    fireEvent.click(
      screen.getByRole('radio', { name: en['dsp.room.head.small'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ head: 'small' }),
    );
  });

  it('names what is playing when nothing is, and the missing head', () => {
    renderCard(undefined, { state: 'idle', channels: undefined });
    expect(screen.getByText(en['dsp.room.live.idle'])).not.toHaveClass('is-on');
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-asleep'),
    ).toHaveLength(0);
  });

  it('puts the speakers a stereo stream cannot reach to sleep, and says so', () => {
    renderCard(undefined, { state: 'front-stage', channels: 2 });
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-asleep'),
    ).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent(
      en['dsp.room.fedFrontStage'],
    );
    // Asleep ones cannot be taken; the two awake still can.
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-asleep.can-drag'),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll('.dsp-room-speaker.can-drag'),
    ).toHaveLength(2);
    // No subwoofer feed either: the sub sleeps and its dial, and the
    // centre's, rest disabled; the room's own dials still turn.
    expect(document.querySelector('.dsp-room-sub')).toHaveClass('is-asleep');
    expect(screen.getByLabelText(en['dsp.room.sub'])).toBeDisabled();
    expect(screen.getByLabelText(en['dsp.room.centre'])).toBeDisabled();
    expect(screen.getByLabelText(en['dsp.room.size'])).not.toBeDisabled();
  });

  it('wakes the sub and its dial on 7.1', () => {
    renderCard();
    expect(document.querySelector('.dsp-room-sub')).not.toHaveClass(
      'is-asleep',
    );
    expect(screen.getByLabelText(en['dsp.room.sub'])).not.toBeDisabled();
  });

  it('offers bass management with its crossover, off the Plus lock', () => {
    entitled = false;
    const { onPatch, onCommit } = renderCard();
    expect(screen.getByLabelText(en['dsp.room.crossover'])).not.toBeDisabled();
    fireEvent.click(
      screen.getByRole('radio', { name: en['dsp.room.bass.full'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ bassManagement: false }),
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('fills the room with stereo music on request, and lights every speaker', () => {
    const { onPatch } = renderCard(undefined, { state: 'music', channels: 2 });
    expect(screen.getByText(en['dsp.room.live.music'])).toHaveClass('is-on');
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-asleep'),
    ).toHaveLength(0);
    expect(screen.getByLabelText(en['dsp.room.music.amount'])).toBeDisabled();
    fireEvent.click(
      screen.getByRole('radio', { name: en['dsp.room.music.fill'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ musicUpmix: true }),
    );
  });

  it('rests the crossover dial while the bass runs full range', () => {
    renderCard({ ...DSP_DEFAULTS.room, enabled: true, bassManagement: false });
    expect(screen.getByLabelText(en['dsp.room.crossover'])).toBeDisabled();
  });

  it('leaves the rear pair asleep on 5.1', () => {
    renderCard(undefined, { state: '5.1', channels: 6 });
    expect(
      document.querySelectorAll('.dsp-room-speaker.is-asleep'),
    ).toHaveLength(2);
  });
});

describe('the room presets', () => {
  it('leave the listener alone and name themselves', () => {
    const custom: IRoomSettings = {
      ...DSP_DEFAULTS.room,
      presetId: 'custom',
      head: 'small',
      correctHeadphones: false,
      angles: [-20, 20, 0, -90, 90, -150, 150],
    };
    const studio = roomPresetSettings(custom, 'studio');
    expect(studio.presetId).toBe('studio');
    expect(studio.head).toBe('small');
    expect(studio.correctHeadphones).toBe(false);
    expect(studio.angles).toEqual(DSP_DEFAULTS.room.angles);
    expect(studio.sizeM).toBe(ROOM_PRESET_SHAPES.studio.sizeM);
    // Its own arrays: editing the result must not edit the shape table.
    studio.angles[0] = 1;
    expect(ROOM_PRESET_SHAPES.studio.angles[0]).toBe(-30);
  });

  it('the front stage pulls the surrounds back and keeps the front flat', () => {
    expect(ROOM_PRESET_SHAPES.frontStage.levels).toEqual([
      0, 0, 0, -6, -6, -6, -6,
    ]);
  });
});
