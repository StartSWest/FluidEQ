/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Online Media laid out as the Library is (2026-11-19): the sites, the
 * recent searches and the account down the studio rail, and the Library's
 * bar over the page. Each behaviour beside the case that says it is not
 * always so, so a part that does nothing cannot pass by doing nothing.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import VideoRail from '../../../renderer/video/VideoRail';
import VideoSearch from '../../../renderer/video/VideoSearch';
import VideoSignOut from '../../../renderer/video/VideoSignOut';
import VideoTopBar from '../../../renderer/video/VideoTopBar';
import {
  addSearchToHistory,
  clearSearchHistory,
} from '../../../renderer/utils/videoSearchHistory';
import { sendRequest } from '../../../renderer/utils/ipcRequest';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const mockIdentity: { media?: { isPlaying: boolean } } = {};
jest.mock('../../../renderer/audio/transportSource', () => ({
  useTransportIdentitySources: () => mockIdentity,
}));

jest.mock('../../../renderer/utils/ipcRequest', () => ({
  sendRequest: jest.fn(),
  simpleResponseHandler: () => (value: unknown) => value,
}));

const railProps = {
  onSite: jest.fn(),
  onRunSearch: jest.fn(),
};

const rail = (activeSiteId: string) => (
  <VideoRail
    activeSiteId={activeSiteId}
    onSite={railProps.onSite}
    onRunSearch={railProps.onRunSearch}
    foot={null}
  />
);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  clearSearchHistory();
  delete mockIdentity.media;
});

describe('the rail', () => {
  it('carries the page’s name and marks the open site as the Library marks a shelf', () => {
    render(rail('bandcamp'));
    expect(screen.getByText('tabs.media')).toBeInTheDocument();
    const sites = within(
      screen.getByRole('navigation', { name: 'video.sites' }),
    );
    expect(sites.getByRole('button', { name: /Bandcamp/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      sites.getByRole('button', { name: /^YouTube$/ }),
    ).not.toHaveAttribute('aria-current');
    // Every site has its mark, Suno included: a folded rail is marks alone.
    sites.getAllByRole('button').forEach((site) => {
      expect(site.querySelector('svg path')).not.toBeNull();
    });
  });

  it('opens a site when its row is pressed', async () => {
    render(rail('youtube'));
    await userEvent.click(screen.getByRole('button', { name: /Twitch/ }));
    expect(railProps.onSite).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'twitch' }),
    );
  });

  it('puts the live dot on the open site while it plays, and nowhere while it does not', () => {
    mockIdentity.media = { isPlaying: true };
    const { container, rerender } = render(rail('youtube-music'));
    const dots = container.querySelectorAll('.video-rail__live');
    expect(dots).toHaveLength(1);
    expect(dots[0].closest('button')).toHaveTextContent('YouTube Music');

    mockIdentity.media = { isPlaying: false };
    rerender(rail('bandcamp'));
    expect(container.querySelectorAll('.video-rail__live')).toHaveLength(0);
  });

  it('runs a recent search from the rail, newest first, and forgets one on its own', async () => {
    addSearchToHistory('synthwave mix');
    addSearchToHistory('lofi beats');
    render(rail('youtube'));
    const recent = within(
      screen.getByRole('list', { name: 'video.searchRecent' }),
    );
    expect(
      recent
        .getAllByRole('button', { name: /^(lofi beats|synthwave mix)$/ })
        .map((button) => button.textContent),
    ).toEqual(['lofi beats', 'synthwave mix']);

    await userEvent.click(recent.getByRole('button', { name: 'lofi beats' }));
    expect(railProps.onRunSearch).toHaveBeenCalledWith('lofi beats');

    await userEvent.click(
      recent.getByRole('button', { name: 'video.searchForget synthwave mix' }),
    );
    expect(screen.queryByText('synthwave mix')).not.toBeInTheDocument();
    expect(screen.getByText('lofi beats')).toBeInTheDocument();
  });

  it('says what will appear before anything has been searched', () => {
    render(rail('youtube'));
    expect(screen.getByText('video.recentEmpty')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'video.searchRecent' }),
    ).not.toBeInTheDocument();
  });
});

describe('the search field', () => {
  const Field = () => {
    const [query, setQuery] = useState('');
    return (
      <VideoSearch
        query={query}
        onQueryChange={setQuery}
        onRun={jest.fn()}
        siteName="YouTube"
      />
    );
  };

  it('keeps its list shut on a bare focus, the rail showing the same searches', async () => {
    addSearchToHistory('lofi beats');
    render(<Field />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('finishes a typed word from what was searched before', async () => {
    addSearchToHistory('lofi beats');
    render(<Field />);
    await userEvent.type(screen.getByRole('combobox'), 'lo');
    expect(
      within(screen.getByRole('listbox')).getByText('lofi beats'),
    ).toBeInTheDocument();
  });
});

describe('the bar', () => {
  const bar = (currentUrl: string) => (
    <VideoTopBar
      canGoBack
      canGoForward={false}
      isLoading={false}
      onBack={jest.fn()}
      onForward={jest.fn()}
      onReloadOrStop={jest.fn()}
      currentUrl={currentUrl}
      query=""
      onQueryChange={jest.fn()}
      onRunSearch={jest.fn()}
      siteName="YouTube"
    />
  );

  it('says where the page is: the host without its www, and the first step of the path', () => {
    const { container } = render(bar('https://www.youtube.com/watch?v=abc'));
    const address = container.querySelector('.video-browser__address');
    expect(address).toHaveTextContent('youtube.com');
    expect(address).toHaveTextContent('watch');
    expect(address).not.toHaveTextContent('www');
  });

  it('says nothing for an address with no host', () => {
    const { container } = render(bar('about:blank'));
    expect(container.querySelector('.video-browser__address')).toBeNull();
  });
});

describe('signing out from the rail’s foot', () => {
  const animationEnd = (element: Element, animationName: string) => {
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    act(() => {
      element.dispatchEvent(event);
    });
  };

  it('says it signed out until the glyph’s hold ends, then offers it again', async () => {
    jest.mocked(sendRequest).mockResolvedValue(true);
    render(<VideoSignOut />);
    await userEvent.click(
      screen.getByRole('button', { name: 'video.signOut' }),
    );
    const done = await screen.findByRole('button', {
      name: 'video.signOutDone',
    });
    const glyph = done.querySelector('svg');
    if (!glyph) {
      throw new Error('the sign-out row drew no glyph');
    }
    // Another animation ending on the glyph is not the hold.
    animationEnd(glyph, 'rise-in');
    expect(done).toHaveAccessibleName('video.signOutDone');
    animationEnd(glyph, 'video-sign-out-said');
    expect(
      screen.getByRole('button', { name: 'video.signOut' }),
    ).toBeInTheDocument();
  });

  it('says so when it could not', async () => {
    jest.mocked(sendRequest).mockResolvedValue(false);
    render(<VideoSignOut />);
    await userEvent.click(
      screen.getByRole('button', { name: 'video.signOut' }),
    );
    expect(
      await screen.findByRole('button', { name: 'video.signOutFailed' }),
    ).toBeInTheDocument();
  });
});
