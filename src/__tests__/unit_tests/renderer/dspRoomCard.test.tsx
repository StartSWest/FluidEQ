/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import {
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

  it('applies a preset as a whole room and keeps the head', () => {
    const { onPatch, onCommit } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      head: 'large',
    });
    fireEvent.click(
      screen.getByRole('radio', { name: en['dsp.room.preset.cinema'] }),
    );
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'cinema',
        sizeM: ROOM_PRESET_SHAPES.cinema.sizeM,
        subDb: ROOM_PRESET_SHAPES.cinema.subDb,
        head: 'large',
      }),
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
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
      screen.getByRole('radio', { name: en['dsp.room.preset.studio'] }),
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
