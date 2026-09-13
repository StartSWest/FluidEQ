/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The Studio's meters, written once a frame.
 *
 * Replacing a readout's text node every frame is an insertion into the
 * document, and the page's `:has()` rules on its outermost boxes answer every
 * insertion by restyling from the top — which, with a canvas reading its
 * colours each frame, restyled and relaid the whole Studio sixty times a
 * second. So the number changes in the node that is already there.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { createRef, type MutableRefObject } from 'react';
import { NEUTRAL_RESPONSE } from '../../../common/sceneResponse';
import { SPECTRUM_TEXELS } from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import StudioMeters from '../../../renderer/studio/StudioMeters';
import type { TStageDrawn } from '../../../renderer/studio/StudioStage';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const frame = (level: number): ISceneFrame => ({
  timeSeconds: 0,
  level,
  beat: 0,
  bands: [0, 0, 0],
  accent: [0, 0, 0],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(4),
  params: {},
});

it('changes a readout in the text node it already has', () => {
  const feed = createRef<TStageDrawn>() as MutableRefObject<
    TStageDrawn | undefined
  >;
  const { container } = render(
    <StudioMeters
      feed={feed}
      onScale={jest.fn()}
      response={NEUTRAL_RESPONSE}
    />,
  );
  const draw = feed.current;
  if (!draw) {
    throw new Error('the meters did not take the feed');
  }
  const value = container.querySelector(
    '.studio-meter--level .studio-meter__value',
  );
  if (!value) {
    throw new Error('no level readout');
  }

  draw(frame(0.25), 1, 0, frame(0.25));
  const node = value.firstChild;
  expect(value).toHaveTextContent('0.25');

  draw(frame(0.5), 1, 0, frame(0.5));
  // The control: the number did change, so a kept node is not a stale one.
  expect(value).toHaveTextContent('0.50');
  expect(value.firstChild).toBe(node);
  expect(value.childNodes).toHaveLength(1);
});
