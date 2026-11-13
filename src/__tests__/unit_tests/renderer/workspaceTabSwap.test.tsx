/* FluidEQ — GPL-3.0-or-later */

import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { translate, type Translate } from '../../../common/i18n';
import {
  WorkspaceTabsLeft,
  WorkspaceTabsRight,
} from '../../../renderer/shell/WorkspaceTabStrips';
import { I18nProvider } from '../../../renderer/utils/I18nContext';

let configured = true;
// Navigation is tested here; locale loading is covered by I18nContext tests.
jest.mock('../../../renderer/utils/I18nContext', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
  useTranslation: () => ({
    locale: 'en',
    t: (key: Parameters<Translate>[0], vars?: Parameters<Translate>[1]) =>
      translate('en', key, vars),
  }),
}));
jest.mock('../../../common/accountConfig', () => ({
  isAccountConfigured: () => configured,
}));
jest.mock('../../../renderer/games/useGameSound', () => ({
  useSoundingGame: () => undefined,
}));
jest.mock('../../../renderer/utils/useMediaQuery', () => ({
  __esModule: true,
  default: () => false,
}));
// The animated highlight is checked visually; this suite checks destinations.
jest.mock('../../../renderer/utils/useSlidingIndicator', () => ({
  useSlidingIndicator: () => ({ ref: () => undefined, box: undefined }),
}));
beforeEach(() => {
  configured = true;
  localStorage.clear();
});

it('places Visualizers on the left and Online Media on the right with their original destinations', () => {
  const select = jest.fn();
  const approach = jest.fn();
  const view = render(
    <I18nProvider>
      <WorkspaceTabsLeft
        activeTab="community"
        lastEqTab="eq"
        onSelect={select}
        onApproach={approach}
      />
    </I18nProvider>,
  );
  expect(
    screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label')),
  ).toEqual(['Scenes', 'Share Audio', 'Gaming Lab', 'EQ']);
  fireEvent.click(screen.getByRole('tab', { name: 'Scenes' }));
  fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Scenes' }));
  expect(select).toHaveBeenCalledWith('community');
  expect(approach).toHaveBeenCalledWith('community');
  expect(screen.getByRole('tab', { name: 'Scenes' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  view.unmount();
  render(
    <I18nProvider>
      <WorkspaceTabsRight
        activeTab="video"
        onSelect={select}
        onApproach={approach}
      />
    </I18nProvider>,
  );
  expect(
    screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label')),
  ).toEqual(['DSP', 'Library', 'Karaoke', 'Online Media']);
  fireEvent.click(screen.getByRole('tab', { name: 'Online Media' }));
  expect(select).toHaveBeenCalledWith('video');
});

it('keeps Online Media available in builds without the Visualizers backend', () => {
  configured = false;
  render(
    <I18nProvider>
      <WorkspaceTabsLeft
        activeTab="video"
        lastEqTab="eq"
        onSelect={jest.fn()}
        onApproach={jest.fn()}
      />
      <WorkspaceTabsRight
        activeTab="video"
        onSelect={jest.fn()}
        onApproach={jest.fn()}
      />
    </I18nProvider>,
  );
  expect(screen.queryByRole('tab', { name: 'Scenes' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Online Media' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
