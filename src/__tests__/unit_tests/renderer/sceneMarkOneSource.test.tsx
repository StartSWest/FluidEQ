/* FluidEQ — GPL-3.0-or-later */

/**
 * One mark for a scene (Ivan, 2026-11-13: "put the graph one, the same as
 * in the gallery"). The title bar's Scenes tab wore a sparkle while the
 * Gallery row of the Scenes rail, under it, wore the spectrum, so one screen
 * said "scenes" with two pictures. What is held: the tab draws exactly the
 * strokes the rail's gallery entry draws, and so do the compact player's
 * page menu and the "New in Scenes" announcement, beside a control that a
 * different mark would be told apart.
 */

import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { translate, type Translate } from '../../../common/i18n';
import Glyph from '../../../renderer/community/Glyph';
import { PLACES } from '../../../renderer/community/CommunityPanel';
import MenuIcon from '../../../renderer/icons/MenuIcon';
import { SCENE_MARK_PATHS } from '../../../renderer/icons/SceneMark';
import { WorkspaceTabsLeft } from '../../../renderer/shell/WorkspaceTabStrips';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
  useTranslation: () => ({
    locale: 'en',
    t: (key: Parameters<Translate>[0], vars?: Parameters<Translate>[1]) =>
      translate('en', key, vars),
  }),
}));
jest.mock('../../../common/accountConfig', () => ({
  isAccountConfigured: () => true,
}));
jest.mock('../../../renderer/games/useGameSound', () => ({
  useSoundingGame: () => undefined,
}));
jest.mock('../../../renderer/utils/useMediaQuery', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('../../../renderer/utils/useSlidingIndicator', () => ({
  useSlidingIndicator: () => ({ ref: () => undefined, box: undefined }),
}));

/** What an icon draws: its grid, its stroke and every stroke's shape. */
const drawingOf = (svg: SVGSVGElement | null) => ({
  viewBox: svg?.getAttribute('viewBox'),
  strokeWidth: svg?.getAttribute('stroke-width'),
  paths: [...(svg?.querySelectorAll('path') ?? [])].map((path) => [
    path.getAttribute('d'),
    path.getAttribute('opacity'),
  ]),
});

const galleryEntryDrawing = () => {
  const gallery = PLACES.find((place) => place.place === 'visualizers');
  expect(gallery).toBeDefined();
  const { container } = render(<Glyph name={gallery?.glyph ?? 'general'} />);
  return drawingOf(container.querySelector('svg'));
};

it('draws the Scenes tab with the rail gallery entry’s own mark', () => {
  const gallery = galleryEntryDrawing();
  render(
    <WorkspaceTabsLeft
      activeTab="community"
      lastEqTab="eq"
      onSelect={jest.fn()}
      onApproach={jest.fn()}
    />,
  );
  const tab = screen.getByRole('tab', { name: 'Scenes' });
  const drawn = drawingOf(tab.querySelector('svg'));
  expect(drawn.paths).toEqual(gallery.paths);
  expect(drawn.viewBox).toBe(gallery.viewBox);
  expect(drawn.strokeWidth).toBe(gallery.strokeWidth);
  // And that is the mark, from its one source.
  expect(drawn.paths.map(([d]) => d)).toEqual(
    SCENE_MARK_PATHS.map(({ d }) => d),
  );
});

it('gives every shell icon named for a scene the same mark', () => {
  const gallery = galleryEntryDrawing();
  const { container } = render(<MenuIcon name="scene" />);
  expect(drawingOf(container.querySelector('svg')).paths).toEqual(
    gallery.paths,
  );
});

it('would tell a different mark apart', () => {
  const gallery = galleryEntryDrawing();
  const { container } = render(<Glyph name="studio" />);
  expect(drawingOf(container.querySelector('svg')).paths).not.toEqual(
    gallery.paths,
  );
});
