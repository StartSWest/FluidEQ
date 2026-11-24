/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { dynamicsPresetSettings } from '../../../common/dsp/dynamicsPresets';
import type { IDynamicsSettings } from '../../../common/dsp/dynamicsStage';
import DspDynamicsControls, {
  DYNAMICS_NARROW_BELOW,
} from '../../../renderer/dsp/DspDynamicsControls';
import dynamicsGainDb, {
  heardGainDb,
  mixedGainDb,
} from '../../../renderer/dsp/dynamicsCurve';
import { dynamicsPlot } from '../../../renderer/dsp/dynamicsPlot';
import { dragPoint } from '../../../renderer/dsp/dynamicsPoints';
import { setDspDynamicsReport } from '../../../renderer/dsp/dynamicsTelemetry';
import { startGraphLoop } from '../../../renderer/dsp/graphLoop';
import useDynamicsLive, {
  RESTING_DYNAMICS,
} from '../../../renderer/dsp/useDynamicsLive';
import { clearDspAnalysers, setDspAnalyser } from '../../../renderer/dsp/store';

jest.mock('../../../renderer/dsp/graphLoop', () => ({
  startGraphLoop: jest.fn(),
}));

// jsdom has no PointerEvent, and the generic event Testing Library falls
// back to carries no button and no coordinates: a mouse event with an id is
// what the points read from one.
if (!('PointerEvent' in window)) {
  class PointerEventStandIn extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.assign(window, { PointerEvent: PointerEventStandIn });
}

let paint: () => void = () => undefined;
const settings: IDynamicsSettings = dynamicsPresetSettings('vocal', true);
const analyser = {
  frequencyBinCount: 1024,
  getFloatFrequencyData: (out: Float32Array) => out.fill(-60),
};
/** The width the card's root reports; 0 is a box not laid out. */
let cardWidth = 0;

beforeEach(() => {
  cardWidth = 0;
  paint = () => undefined;
  jest.mocked(startGraphLoop).mockImplementation((callback) => {
    const schedule = jest.fn();
    paint = () => callback({ schedule });
    return { schedule, stop: jest.fn() };
  });
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function measure(this: HTMLElement) {
      const width = this.classList.contains('dsp-dynamics-curves')
        ? cardWidth
        : 0;
      return {
        width,
        height: 0,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
});
afterEach(() => {
  cleanup();
  clearDspAnalysers();
  setDspDynamicsReport(undefined);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

/** The controls on the engine's live readings, as the card mounts them. */
const LiveControls = ({
  dynamics,
  onPatch,
  onCommit,
}: {
  dynamics: IDynamicsSettings;
  onPatch: (next: IDynamicsSettings) => void;
  onCommit: () => void;
}) => (
  <DspDynamicsControls
    bus={useDynamicsLive(dynamics)}
    dynamics={dynamics}
    onPatch={onPatch}
    onCommit={onCommit}
  />
);

const renderControls = (dynamics: IDynamicsSettings = settings) => {
  const onPatch = jest.fn();
  const onCommit = jest.fn();
  const view = render(
    <LiveControls dynamics={dynamics} onPatch={onPatch} onCommit={onCommit} />,
  );
  return { ...view, onPatch, onCommit };
};

const curves = () =>
  screen.queryAllByRole('group', { name: /What each band does to its level/ });

describe('the layout the card chooses', () => {
  it('draws three curves side by side on a wide card', () => {
    cardWidth = DYNAMICS_NARROW_BELOW;
    renderControls();
    expect(curves()).toHaveLength(3);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('turns the bands into tabs over one curve on a narrow card', () => {
    cardWidth = DYNAMICS_NARROW_BELOW - 1;
    renderControls();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Lows0.0 dB',
      'Middle0.0 dB',
      'Highs0.0 dB',
    ]);
    expect(curves()).toHaveLength(1);
    expect(curves()[0]).toHaveAccessibleName(/^Lows/);
    fireEvent.click(tabs[2]);
    expect(curves()).toHaveLength(1);
    expect(curves()[0]).toHaveAccessibleName(/^Highs/);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/Highs/);
  });
});

describe('the live readings', () => {
  it('hold every slot from the first frame, playing or not', () => {
    const { container } = renderControls({ ...settings, makeupDb: 0 });
    const readouts = [...container.querySelectorAll('.dsp-dynamics-readout')];
    expect(readouts.map((node) => node.getAttribute('data-state'))).toEqual([
      'silent',
      'silent',
      'silent',
    ]);
    // Every word a readout can say is laid out from the start.
    readouts.forEach((node) => {
      expect(
        node.querySelectorAll('.dsp-dynamics-readout__state'),
      ).toHaveLength(6);
    });
    const hints = container.querySelector('.dsp-dynamics-hints');
    expect(hints?.getAttribute('data-heard')).toBe('no');
    expect(hints?.children).toHaveLength(2);
    const marks = container.querySelectorAll('.dsp-dynamics-live');
    expect(marks).toHaveLength(3);
    marks.forEach((node) =>
      expect(node.getAttribute('visibility')).toBe('hidden'),
    );
    const before = container.querySelectorAll('*').length;

    setDspAnalyser('dynamicsIn', analyser);
    setDspDynamicsReport({
      active: true,
      levelDb: [-20, -40, -50],
      gainDb: [-2.5, 3, 0],
    });
    act(() => paint());

    expect(container.querySelectorAll('*').length).toBe(before);
    expect(readouts.map((node) => node.getAttribute('data-state'))).toEqual([
      'holding',
      'lifting',
      'untouched',
    ]);
    expect(
      readouts.map(
        (node) =>
          node.querySelector('.dsp-dynamics-readout__value span')?.textContent,
      ),
    ).toEqual(['-2.5', '+3.0', '0.0']);
    expect(hints?.getAttribute('data-heard')).toBe('yes');
    marks.forEach((node) =>
      expect(node.getAttribute('visibility')).toBe('visible'),
    );
  });

  it('rides the curve as heard, the mix included and the make-up taken out', () => {
    const mixed: IDynamicsSettings = { ...settings, mix: 0.5, makeupDb: 4 };
    const { container } = renderControls(mixed);
    const level = -10;
    const band = mixed.bands[1];
    setDspAnalyser('dynamicsIn', analyser);
    setDspDynamicsReport({
      active: true,
      levelDb: [-80.5, level, -80.5],
      gainDb: [
        mixedGainDb(0, 4, 0.5),
        mixedGainDb(dynamicsGainDb(band, level), 4, 0.5),
        mixedGainDb(0, 4, 0.5),
      ],
    });
    act(() => paint());
    // Unmeasured boxes draw at the curve's fallback width.
    const plot = dynamicsPlot(240, 340);
    const dot = container.querySelectorAll('.dsp-dynamics-live__dot')[1];
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(plot.x(level), 0);
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(
      plot.y(level + heardGainDb(band, level, 4, 0.5)),
      0,
    );
    // The make-up alone reads as nothing done, never as a lift.
    const readouts = container.querySelectorAll('.dsp-dynamics-readout');
    expect(readouts[0].getAttribute('data-state')).toBe('untouched');
    // A band under the plot's floor has no dot to place.
    expect(
      container
        .querySelectorAll('.dsp-dynamics-live')[0]
        .getAttribute('visibility'),
    ).toBe('hidden');
  });
});

describe('the points', () => {
  it('step the value their drag moves from the keyboard, and commit on release', () => {
    const { onPatch, onCommit } = renderControls();
    const top = screen.getByRole('slider', {
      name: 'Middle · How far the lift goes',
    });
    fireEvent.keyDown(top, { key: 'ArrowRight' });
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ presetId: '' }),
    );
    const next = onPatch.mock.calls[0][0] as IDynamicsSettings;
    expect(next.bands[1].upRatio).toBeCloseTo(
      settings.bands[1].upRatio + 0.1,
      9,
    );
    expect({ ...next.bands[1], upRatio: 0 }).toEqual({
      ...settings.bands[1],
      upRatio: 0,
    });
    expect(next.bands[0]).toBe(settings.bands[0]);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(top, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('set the hold ratio when the end is dragged down, and commit when let go', () => {
    const { onPatch, onCommit } = renderControls();
    const end = screen.getByRole('slider', {
      name: 'Lows · How hard the hold is',
    });
    const plot = dynamicsPlot(240, 340);
    const endOut = dynamicsGainDb(settings.bands[0], 0);
    // Pressed 4 px above the point's middle: the point must not jump there.
    const pressY = plot.y(endOut) - 4;
    fireEvent.pointerDown(end, {
      button: 0,
      clientX: plot.x(0),
      clientY: pressY,
    });
    fireEvent.pointerMove(end, { clientX: plot.x(0), clientY: pressY + 20 });
    const calls = onPatch.mock.calls as IDynamicsSettings[][];
    const next = calls[calls.length - 1][0];
    // Twenty pixels down from wherever it was held: the end 20 px lower.
    expect(next.bands[0]).toEqual(
      dragPoint(
        'holdEnd',
        settings.bands[0],
        0,
        plot.outAt(plot.y(endOut) + 20),
      ),
    );
    expect(next.bands[0].downRatio).toBeGreaterThan(
      settings.bands[0].downRatio,
    );
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(end);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('cannot be moved while the stage is off, and the readouts say so', () => {
    const { onPatch, container } = renderControls({
      ...settings,
      enabled: false,
    });
    const top = screen.getByRole('slider', {
      name: 'Middle · How far the lift goes',
    });
    expect(top).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(top, { key: 'ArrowUp' });
    expect(onPatch).not.toHaveBeenCalled();
    setDspAnalyser('dynamicsIn', analyser);
    setDspDynamicsReport({
      active: false,
      levelDb: [-120, -120, -120],
      gainDb: [0, 0, 0],
    });
    act(() => paint());
    expect(
      [...container.querySelectorAll('.dsp-dynamics-readout')].map((node) =>
        node.getAttribute('data-state'),
      ),
    ).toEqual(['off', 'off', 'off']);
  });

  it('stay still in a drawing on example settings, whatever is playing', () => {
    setDspAnalyser('dynamicsIn', analyser);
    setDspDynamicsReport({
      active: true,
      levelDb: [-20, -20, -20],
      gainDb: [-3, -3, -3],
    });
    const { container } = render(
      <DspDynamicsControls
        bus={RESTING_DYNAMICS}
        dynamics={settings}
        onPatch={jest.fn()}
        onCommit={jest.fn()}
      />,
    );
    act(() => paint());
    container.querySelectorAll('.dsp-dynamics-live').forEach((node) => {
      expect(node.getAttribute('visibility')).toBe('hidden');
    });
    expect(
      container
        .querySelector('.dsp-dynamics-readout')
        ?.getAttribute('data-state'),
    ).toBe('silent');
  });
});
