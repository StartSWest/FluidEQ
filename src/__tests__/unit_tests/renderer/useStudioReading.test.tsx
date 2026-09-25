/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio stage's frame callbacks. Every frame goes to the meters the
 * moment it is made, and once drawn, what it cost is written straight into
 * the test card's reading and the stage's own corner, never through React:
 * each element against its own text, so a corner that has just appeared is
 * filled on the next frame even when the figure has not moved, and an
 * element already showing the figure is left alone.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { SPECTRUM_TEXELS } from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type {
  TStageDrawn,
  TStageHeard,
} from '../../../renderer/studio/StudioStage';
import useStudioReading from '../../../renderer/studio/useStudioReading';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

const frame: ISceneFrame = {
  timeSeconds: 0,
  level: 0.5,
  beat: 0,
  bands: [0, 0, 0],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0, 0],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(4),
  params: {},
};

const report = {
  scale: 0.5,
  costMs: 2.25,
  intervalMs: 16,
  drawnWidth: 800,
  drawnHeight: 400,
  outputWidth: 1600,
  outputHeight: 800,
  fsr: false,
  fxaa: false,
};

let onDrawn: TStageDrawn | undefined;
let onHeard: TStageHeard | undefined;

/** The card's reading is always there; the stage's corner only when asked. */
function Bench({
  corner,
  feed,
  onScale = () => undefined,
}: {
  corner: boolean;
  feed: RefObject<TStageHeard | undefined>;
  onScale?: (scale: number) => void;
}) {
  const reading = useStudioReading(feed, onScale);
  onDrawn = reading.onDrawn;
  onHeard = reading.onHeard;
  return (
    <>
      <span data-testid="card" ref={reading.readingRef} />
      {corner && <span data-testid="corner" ref={reading.stageReadingRef} />}
    </>
  );
}

/** One frame, drawn at `atMs` on the clock the bench reads. */
const draw = (
  atMs: number,
  changed: Partial<typeof report> = {},
  drawnScale = 0.5,
) => {
  const drawn = onDrawn;
  if (!drawn) {
    throw new Error('the bench gave the stage no frame callback');
  }
  const now = jest.spyOn(performance, 'now').mockReturnValue(atMs);
  try {
    drawn(frame, drawnScale, 0.25, frame, { ...report, ...changed });
  } finally {
    now.mockRestore();
  }
};

/** No meters listening yet: the feed they fill in is still empty. */
const noMeters = (): RefObject<TStageHeard | undefined> => ({
  current: undefined,
});

const textOf = (testId: string) => screen.getByTestId(testId).textContent;

it('hands every frame to the meters as it is made, not once drawn', () => {
  const meters = jest.fn<void, Parameters<TStageHeard>>();
  render(<Bench corner feed={{ current: meters }} />);
  if (!onHeard) {
    throw new Error('the bench gave the stage no heard callback');
  }
  onHeard(frame, frame, 0.25);
  expect(meters).toHaveBeenCalledTimes(1);
  expect(meters).toHaveBeenCalledWith(frame, frame, 0.25);
  // The drawn frame does not reach them a second time, a GPU's trip late.
  draw(1000);
  expect(meters).toHaveBeenCalledTimes(1);
});

it("writes the same reading into the card and the stage's corner", () => {
  render(<Bench corner feed={noMeters()} />);
  draw(1000);
  expect(textOf('card')).toMatch(/^studio\.cost\.reading \{/);
  expect(textOf('card')).toContain('"size":"50"');
  expect(textOf('corner')).toBe(textOf('card'));
});

it('reads the rate alone where the GPU gave no time for the frame', () => {
  render(<Bench corner={false} feed={noMeters()} />);
  draw(1000, { costMs: undefined });
  expect(textOf('card')).toMatch(/^studio\.cost\.readingRate \{/);
});

it('fills a corner that appears after the reading last changed', () => {
  const feed = noMeters();
  const { rerender } = render(<Bench corner={false} feed={feed} />);
  draw(1000);
  const reading = textOf('card');
  expect(reading).toMatch(/^studio\.cost\.reading \{/);
  rerender(<Bench corner feed={feed} />);
  expect(screen.getByTestId('corner')).toBeEmptyDOMElement();
  draw(1016);
  // The figure did not move: the card is as it was, and the corner caught up.
  expect(textOf('card')).toBe(reading);
  expect(textOf('corner')).toBe(reading);
});

it('leaves an element alone while its figure has not moved', () => {
  render(<Bench corner={false} feed={noMeters()} />);
  draw(1000);
  const watch = new MutationObserver(() => undefined);
  watch.observe(screen.getByTestId('card'), {
    childList: true,
    characterData: true,
    subtree: true,
  });
  draw(1016);
  expect(watch.takeRecords()).toHaveLength(0);
  // The control: a figure that does move is written, and seen.
  draw(1032, { scale: 1 });
  expect(watch.takeRecords().length).toBeGreaterThan(0);
  expect(textOf('card')).toContain('"size":"100"');
  watch.disconnect();
});

it("tells the bench the stage's scale when it changes, and not every frame", () => {
  const onScale = jest.fn();
  render(<Bench corner={false} feed={noMeters()} onScale={onScale} />);
  draw(1000);
  draw(1016);
  draw(1032);
  expect(onScale.mock.calls).toEqual([[0.5]]);
  draw(1048, {}, 0.75);
  draw(1064, {}, 0.75);
  expect(onScale.mock.calls).toEqual([[0.5], [0.75]]);
});
