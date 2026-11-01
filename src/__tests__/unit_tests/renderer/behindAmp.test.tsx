/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What is built behind the amp: nothing of the pages and nothing of the
 * side panel's cards, which used to sleep there with every node, canvas and
 * piece of state kept — except the second output, which plays its mirror
 * through the amp. All of it is built again when the amp goes.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import SoundPanel from 'renderer/shell/SoundPanel';
import WorkspacePages from 'renderer/shell/WorkspacePages';

jest.mock('renderer/MainContent', () => () => <div data-testid="eq-page" />);
jest.mock('renderer/workspacePages', () => ({
  ConfigPage: { Page: () => <div data-testid="config-page" /> },
  ConvolutionPage: { Page: () => <div data-testid="convolution-page" /> },
  ForumPage: { Page: () => <div data-testid="forum-page" /> },
  GamesPage: { Page: () => <div data-testid="games-page" /> },
  PlusPage: { Page: () => <div data-testid="plus-page" /> },
  PresetsPage: { Page: () => <div data-testid="presets-page" /> },
  SharePage: { Page: () => <div data-testid="share-page" /> },
}));
jest.mock('renderer/shell/ShellPanes', () => ({
  DspPage: () => <div data-testid="dsp-page" />,
}));
jest.mock('renderer/components/FluidEngineLabel', () => () => null);
jest.mock('renderer/components/ListenedLatency', () => () => null);
jest.mock('renderer/components/WorkspaceSectionTabs', () => () => null);
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/components/DriverPicker', () => () => (
  <div data-testid="driver" />
));
jest.mock('renderer/components/eqMode/EqModeCard', () => () => (
  <div data-testid="eq-mode" />
));
jest.mock('renderer/DeviceProfiles', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="outputs">{children}</div>
  ),
}));
jest.mock('renderer/ExtraOutputs', () => () => (
  <div data-testid="second-output" />
));
jest.mock('renderer/PresetsBar', () => () => <div data-testid="presets-bar" />);
jest.mock('renderer/components/SongSoundSwitch', () => () => null);
jest.mock('renderer/utils/equalizerApi', () => ({
  createPreset: jest.fn(),
  deletePreset: jest.fn(),
  getPresetListFromFiles: jest.fn(),
  loadPreset: jest.fn(),
  renamePreset: jest.fn(),
  savePreset: jest.fn(),
}));

const pages = (isBehindAmp: boolean, activeTab: 'eq' | 'dsp' = 'eq') => (
  <WorkspacePages
    activeTab={activeTab}
    isBehindAmp={isBehindAmp}
    isEqReachingSound
    isGraphFirst
    eqGroupPills={null}
    onEqPillApproach={jest.fn()}
    onOpenEngineDialog={jest.fn()}
    onSignIn={jest.fn()}
    onShowGalleryGraph={jest.fn()}
  />
);

const panel = (isBehindAmp: boolean) => (
  <SoundPanel
    panelRef={{ current: null }}
    isDrawerOpen={false}
    isShown
    isSliding={false}
    onToggle={jest.fn()}
    isBehindAmp={isBehindAmp}
    engine={null}
    isNoticeHidden={false}
    onConfigureApo={jest.fn()}
    onAttachFluidEngine={jest.fn()}
  />
);

describe('the pages', () => {
  it('are not built behind the amp, and are built again when it goes', async () => {
    const view = render(pages(false));
    expect(await screen.findByTestId('eq-page')).toBeInTheDocument();
    view.rerender(pages(true));
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(pages(false, 'dsp'));
    expect(await screen.findByTestId('dsp-page')).toBeInTheDocument();
  });
});

describe('the side panel', () => {
  it('builds no card behind the amp but the second output, which plays through it', () => {
    const view = render(panel(true));
    expect(screen.queryByTestId('eq-mode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('outputs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('driver')).not.toBeInTheDocument();
    expect(screen.getByTestId('second-output')).toBeInTheDocument();
    // POSITIVE CONTROL: the same panel with the amp gone has every card.
    view.rerender(panel(false));
    expect(screen.getByTestId('eq-mode')).toBeInTheDocument();
    expect(screen.getByTestId('outputs')).toBeInTheDocument();
    expect(screen.getByTestId('presets-bar')).toBeInTheDocument();
    expect(screen.getByTestId('driver')).toBeInTheDocument();
    expect(screen.getByTestId('second-output')).toBeInTheDocument();
  });
});
