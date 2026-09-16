/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import SceneBand from '../../../renderer/plus/SceneBand';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/**
 * The band under the welcome to Plus and at the top of a member's profile.
 *
 * Nothing here can draw a scene — jsdom answers no WebGL2 — which is exactly
 * the state these assertions are about: what the band is while its scene has
 * not started, and what it is for somebody who is not a member.
 */
describe('the scene band', () => {
  it('shows the scene as a picture, at its full height, before it draws', () => {
    const { container } = render(
      <SceneBand playsScene>
        <span>over it</span>
      </SceneBand>,
    );

    const band = container.querySelector('.scene-band');
    // `is-scene` is what the height rests on, not `is-playing`: the picture
    // is up from the first frame, and growing the band once the scene had
    // been fetched and compiled moved the whole panel under it.
    expect(band).toHaveClass('is-scene');
    expect(band).not.toHaveClass('is-playing');
    expect(container.querySelector('.scene-band__still')).toBeInTheDocument();
  });

  it('is the app’s own light, short and still, without a scene', () => {
    const { container } = render(
      <SceneBand>
        <span>over it</span>
      </SceneBand>,
    );

    const band = container.querySelector('.scene-band');
    expect(band).not.toHaveClass('is-scene');
    // No picture of a member's scene on an account that does not have one.
    expect(container.querySelector('.scene-band__still')).toBeNull();
  });
});
