/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    // A group of controls, not a picture: `img` told a screen reader there
    // was nothing inside to operate, and the speakers are what is operated.
    expect(
      screen.getByRole('group', { name: en['dsp.room.graphLabel'] }),
    ).toBeInTheDocument();
    // In the picture: the pane beside it repeats the selected speaker's code.
    expect(
      Array.from(document.querySelectorAll('.dsp-room-speaker-name')).map(
        (label) => label.textContent,
      ),
    ).toEqual(
      expect.arrayContaining(['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR', 'SUB']),
    );
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
    // Two rooms are called Cinema, the featured one and the classic one; the
    // classic one is the room that says its size.
    fireEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(
          `${en['dsp.room.preset.cinema']}.*${ROOM_PRESET_SHAPES.cinema.sizeM.toFixed(1)} m`,
        ),
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

describe('a pressed speaker', () => {
  // jsdom has no pointer capture; the graph takes it on every press.
  beforeAll(() => {
    Element.prototype.setPointerCapture = jest.fn();
    Element.prototype.releasePointerCapture = jest.fn();
    Element.prototype.hasPointerCapture = jest.fn(() => true);
  });
  beforeEach(() => {
    entitled = true;
  });

  // By the label in the picture: the open panel repeats the code as text.
  const groupOf = (name: string) => {
    const label = Array.from(
      document.querySelectorAll('.dsp-room-speaker-name'),
    ).find((text) => text.textContent === name);
    const group = label?.closest('g') ?? null;
    if (group === null) {
      throw new Error(`no speaker ${name}`);
    }
    return group;
  };
  const press = (name: string) => {
    const speaker = groupOf(name);
    fireEvent.pointerDown(speaker, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(speaker, { clientX: 10, clientY: 10, pointerId: 1 });
    return speaker;
  };
  const panelOf = (name: string) => within(screen.getByRole('group', { name }));

  it('has a pane from the start, and the pane follows the speaker that is pressed', () => {
    renderCard();
    // The front left's, before anything is pressed: the pane is never empty
    // and never a press away.
    const first = panelOf(en['dsp.room.speakerName.FL']);
    expect(
      first.getByLabelText(en['dsp.room.speaker.level']),
    ).toBeInTheDocument();
    expect(
      first.getByLabelText(en['dsp.room.speaker.distance']),
    ).toBeInTheDocument();
    expect(
      first.getByLabelText(en['dsp.room.speaker.angle']),
    ).toBeInTheDocument();
    // On the press itself, not the release: a drag has no release until it is
    // over, and the pane is what shows the angle while it moves.
    const speaker = groupOf('SR');
    fireEvent.pointerDown(speaker, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(speaker).toHaveClass('is-selected');
    expect(
      screen.getByRole('group', { name: en['dsp.room.speakerName.SR'] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: en['dsp.room.speakerName.FL'] }),
    ).not.toBeInTheDocument();
    fireEvent.pointerUp(speaker, { clientX: 10, clientY: 10, pointerId: 1 });
    // Pressing it again keeps it: the pane has no closed state to go back to.
    press('SR');
    expect(
      screen.getByRole('group', { name: en['dsp.room.speakerName.SR'] }),
    ).toBeInTheDocument();
  });

  it('sets its own level, distance and angle, which makes the room custom', () => {
    const { onPatch, onCommit } = renderCard();
    press('SR');
    const panel = panelOf(en['dsp.room.speakerName.SR']);
    fireEvent.change(panel.getByLabelText(en['dsp.room.speaker.level']), {
      target: { value: '0.25' },
    });
    let [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.presetId).toBe('custom');
    expect(patched.levels[4]).not.toBe(0);
    expect(patched.levels[0]).toBe(0);
    fireEvent.change(panel.getByLabelText(en['dsp.room.speaker.distance']), {
      target: { value: '0.9' },
    });
    [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.distances[4]).not.toBe(DSP_DEFAULTS.room.distanceM);
    expect(patched.distances[0]).toBe(DSP_DEFAULTS.room.distanceM);
    fireEvent.change(panel.getByLabelText(en['dsp.room.speaker.angle']), {
      target: { value: '75' },
    });
    [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.angles[4]).toBe(75);
    fireEvent.blur(panel.getByLabelText(en['dsp.room.speaker.angle']));
    expect(onCommit).toHaveBeenCalled();
  });

  it('mutes and solos without Plus, and the picture shows the mute', () => {
    entitled = false;
    const { onPatch, onCommit } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      mutes: [false, false, false, false, false, false, true, false],
    });
    expect(groupOf('RR')).toHaveClass('is-muted');
    press('C');
    const panel = panelOf(en['dsp.room.speakerName.C']);
    expect(panel.getByLabelText(en['dsp.room.speaker.level'])).toBeDisabled();
    fireEvent.click(
      panel.getByRole('button', { name: en['dsp.room.speaker.mute'] }),
    );
    // A mute is the room's, like a speaker's level: the room is no longer
    // the preset it was, so a saved room can keep it and Reset take it back.
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [false, false, true, false, false, false, true, false],
        presetId: 'custom',
      }),
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.click(
      panel.getByRole('button', { name: en['dsp.room.speaker.solo'] }),
    );
    // Solo shuts the other six and leaves the sub alone.
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [true, true, false, true, true, true, true, false],
      }),
    );
  });

  it('un-solos a soloed speaker with the same button', () => {
    const { onPatch } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      mutes: [true, true, false, true, true, true, true, true],
    });
    press('C');
    const panel = panelOf(en['dsp.room.speakerName.C']);
    expect(
      panel.getByRole('button', { name: en['dsp.room.speaker.solo'] }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      panel.getByRole('button', { name: en['dsp.room.speaker.solo'] }),
    );
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [false, false, false, false, false, false, false, true],
      }),
    );
  });

  /**
   * ONE STATE. A solo is the other six muted and its own speaker open, so it
   * can never disagree with the mutes: pressed on another speaker it moves
   * there, and pressed on a muted one it opens it. The picture rings it.
   */
  it('moves the solo to another speaker, and opens a muted one it is asked for', () => {
    const { onPatch } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      // The front right soloed; the sub muted on its own account.
      mutes: [true, false, true, true, true, true, true, true],
    });
    expect(groupOf('FR')).toHaveClass('is-soloed');
    expect(groupOf('FL')).not.toHaveClass('is-soloed');
    // The front left is muted — by that solo — and asked for alone.
    press('FL');
    const panel = panelOf(en['dsp.room.speakerName.FL']);
    expect(
      panel.getByRole('button', { name: en['dsp.room.speaker.mute'] }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      panel.getByRole('button', { name: en['dsp.room.speaker.solo'] }),
    ).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(
      panel.getByRole('button', { name: en['dsp.room.speaker.solo'] }),
    );
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [false, true, true, true, true, true, true, true],
      }),
    );
  });

  /**
   * A stereo stream on the front stage reaches the front pair alone. A solo
   * left on a side speaker mutes those two to play one nothing feeds — a room
   * gone quiet with its switch on — so it is let go, there and then, and it
   * cannot be taken while nothing reaches the speaker.
   */
  it('lets go of a solo on a speaker nothing reaches', () => {
    const sideSolo = [true, true, true, true, false, true, true, false];
    const { onPatch, onCommit } = renderCard(
      { ...DSP_DEFAULTS.room, enabled: true, mutes: sideSolo },
      { state: 'front-stage', channels: 2 },
    );
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [false, false, false, false, false, false, false, false],
      }),
    );
    expect(onCommit).toHaveBeenCalled();
  });

  it('keeps a solo the stream does reach (control)', () => {
    const { onPatch } = renderCard(
      {
        ...DSP_DEFAULTS.room,
        enabled: true,
        mutes: [false, true, true, true, true, true, true, false],
      },
      { state: 'front-stage', channels: 2 },
    );
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('lets go of a side solo in the same change that goes back to the front stage', () => {
    const { onPatch } = renderCard(
      {
        ...DSP_DEFAULTS.room,
        enabled: true,
        musicUpmix: true,
        mutes: [true, true, true, true, false, true, true, false],
      },
      { state: 'music', channels: 2 },
    );
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('radio', { name: en['dsp.room.music.front'] }),
    );
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        musicUpmix: false,
        mutes: [false, false, false, false, false, false, false, false],
      }),
    );
  });

  it('gives the sub a level and a mute, no distance, angle or solo', () => {
    const { onPatch } = renderCard();
    expect(press('SUB')).toHaveClass('is-selected');
    const panel = panelOf(en['dsp.room.speakerName.sub']);
    expect(
      panel.getByLabelText(en['dsp.room.speaker.level']),
    ).toBeInTheDocument();
    expect(
      panel.queryByLabelText(en['dsp.room.speaker.distance']),
    ).not.toBeInTheDocument();
    expect(
      panel.queryByLabelText(en['dsp.room.speaker.angle']),
    ).not.toBeInTheDocument();
    expect(
      panel.queryByRole('button', { name: en['dsp.room.speaker.solo'] }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      panel.getByRole('button', { name: en['dsp.room.speaker.mute'] }),
    );
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutes: [false, false, false, false, false, false, false, true],
      }),
    );
  });

  it('moves every speaker with the ring dial', () => {
    const { onPatch } = renderCard({
      ...DSP_DEFAULTS.room,
      enabled: true,
      distances: [1, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
    });
    // The ring's dial, in "Make it yours"; the pane beside it has the
    // selected speaker's own, under the same word.
    const quick = within(
      screen.getByRole('group', { name: en['dsp.room.quick.title'] }),
    );
    fireEvent.change(quick.getByLabelText(en['dsp.room.distance']), {
      target: { value: '0.9' },
    });
    const [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.distances).toEqual(Array(7).fill(patched.distanceM));
    expect(patched.distanceM).not.toBe(DSP_DEFAULTS.room.distanceM);
  });
});

describe('a dragged speaker', () => {
  // jsdom lays nothing out and has no PointerEvent: the picture is given
  // its 400-unit square so a pointer position becomes an angle, pointer
  // events are mouse events with a pointer id, and capture is stubbed.
  beforeAll(() => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      writable: true,
      value: TestPointerEvent,
    });
    Element.prototype.setPointerCapture = jest.fn();
    Element.prototype.releasePointerCapture = jest.fn();
    Element.prototype.hasPointerCapture = jest.fn(() => true);
    jest.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });
  beforeEach(() => {
    entitled = true;
  });

  const groupOf = (name: string) => {
    const label = Array.from(
      document.querySelectorAll('.dsp-room-speaker-name'),
    ).find((text) => text.textContent === name);
    const group = label?.closest('g') ?? null;
    if (group === null) {
      throw new Error(`no speaker ${name}`);
    }
    return group;
  };
  // From the centre to the upper right: 45° from the front.
  const drag = (
    name: string,
    init: { shiftKey?: boolean; ctrlKey?: boolean },
  ) => {
    const speaker = groupOf(name);
    fireEvent.pointerDown(speaker, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerMove(speaker, {
      clientX: 300,
      clientY: 100,
      pointerId: 1,
      ...init,
    });
    fireEvent.pointerUp(speaker, { clientX: 300, clientY: 100, pointerId: 1 });
  };

  it('takes its pair with it, mirrored across the front', () => {
    const { onPatch, onCommit } = renderCard();
    drag('FL', {});
    const [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.angles[0]).toBe(45);
    expect(patched.angles[1]).toBe(-45);
    expect(patched.angles.slice(2)).toEqual(DSP_DEFAULTS.room.angles.slice(2));
    expect(patched.presetId).toBe('custom');
    expect(onCommit).toHaveBeenCalled();
  });

  it('moves alone with Shift or Ctrl held', () => {
    const { onPatch } = renderCard();
    drag('RR', { shiftKey: true });
    let [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.angles[6]).toBe(45);
    expect(patched.angles[5]).toBe(DSP_DEFAULTS.room.angles[5]);
    drag('SL', { ctrlKey: true });
    [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.angles[3]).toBe(45);
    expect(patched.angles[4]).toBe(DSP_DEFAULTS.room.angles[4]);
  });

  it('leaves the centre, which has no pair, on its own', () => {
    const { onPatch } = renderCard();
    drag('C', {});
    const [[patched]] = onPatch.mock.calls.slice(-1) as [[IRoomSettings]];
    expect(patched.angles[2]).toBe(45);
    expect(patched.angles.filter((_angle, at) => at !== 2)).toEqual(
      DSP_DEFAULTS.room.angles.filter((_angle, at) => at !== 2),
    );
  });

  it('gives the pane to the speaker being dragged', () => {
    renderCard();
    drag('FR', {});
    expect(
      screen.getByRole('group', { name: en['dsp.room.speakerName.FR'] }),
    ).toBeInTheDocument();
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
