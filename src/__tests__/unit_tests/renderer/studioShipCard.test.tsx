/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio's bar offers for a scene that plays: publishing it, the
 * main action and the only loud one while there is something to publish,
 * keeping it and playing it on the graph, and behind More sending it and
 * putting it on the desktop — and none of it for a scene that does not play
 * yet.
 */

import '@testing-library/jest-dom';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioShipCard from '../../../renderer/studio/StudioShipCard';
import StudioShipInspect from '../../../renderer/studio/StudioShipInspect';
import type { TPublishCall } from '../../../renderer/studio/versionLine';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const card = (
  overrides: Partial<Parameters<typeof StudioShipCard>[0]> = {},
) => {
  const props = {
    unfit: false,
    onAdd: jest.fn(),
    onPlay: jest.fn(),
    publishing: false,
    onPublish: jest.fn(),
    exporting: false,
    onExport: jest.fn(),
    onSetDesktop: jest.fn(),
    settingDesktop: false,
    unfitReason: undefined as string | undefined,
    onShowProblems: jest.fn(),
    publishCall: 'quiet' as TPublishCall,
    ...overrides,
  };
  render(
    <StudioShipCard
      unfit={props.unfit}
      onAdd={props.onAdd}
      onPlay={props.onPlay}
      publishing={props.publishing}
      onPublish={props.onPublish}
      exporting={props.exporting}
      onExport={props.onExport}
      onSetDesktop={props.onSetDesktop}
      settingDesktop={props.settingDesktop}
      unfitReason={props.unfitReason}
      onShowProblems={props.onShowProblems}
      publishCall={props.publishCall}
    />,
  );
  return props;
};

const more = () => screen.getByRole('button', { name: 'studio.ship.more' });

it('puts Publish last, where the eye ends the bar, with Add, Play and More quiet before it', async () => {
  const props = card({ publishCall: 'ready' });
  const bar = screen.getByRole('group', { name: 'studio.ship.title' });
  const buttons = within(bar).getAllByRole('button');
  const publish = within(bar).getByRole('button', {
    name: 'studio.action.publish',
  });
  expect(buttons[buttons.length - 1]).toBe(publish);
  expect(publish).toHaveClass('button', 'small');
  expect(publish).not.toHaveClass('subtle');
  const add = within(bar).getByRole('button', {
    name: 'studio.action.addToLooks',
  });
  const play = within(bar).getByRole('button', {
    name: 'studio.action.playOnGraph',
  });
  // Ivan, 2026-11-25: Add was the default and should not be.
  [add, play, more()].forEach((quiet) =>
    expect(quiet).toHaveClass('button', 'small', 'subtle'),
  );
  expect(more()).toHaveAttribute('aria-expanded', 'false');
  // Sending and the desktop wait behind More.
  expect(
    screen.queryByRole('menuitem', { name: 'studio.action.export' }),
  ).toBeNull();

  await userEvent.click(more());
  expect(
    screen.getByRole('menu', { name: 'studio.ship.more' }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'studio.action.desktop' }),
  );
  // Choosing one closes the menu.
  expect(screen.queryByRole('menu', { name: 'studio.ship.more' })).toBeNull();
  await userEvent.click(add);
  await userEvent.click(play);
  await userEvent.click(publish);
  expect(props.onAdd).toHaveBeenCalledTimes(1);
  expect(props.onPlay).toHaveBeenCalledTimes(1);
  expect(props.onPublish).toHaveBeenCalledTimes(1);
  expect(props.onSetDesktop).toHaveBeenCalledTimes(1);
});

describe('how loudly Publish asks', () => {
  const publish = () =>
    screen.getByRole('button', { name: 'studio.action.publish' });
  const loud = () =>
    screen
      .getAllByRole('button')
      .filter((button) => !button.classList.contains('subtle'));

  it('is loud with a light running round it while the bench has changes', () => {
    card({ publishCall: 'changes' });
    expect(publish()).not.toHaveClass('subtle');
    expect(publish()).toHaveClass('is-beckoning');
    // One loud action in the bar, and one Publish.
    expect(loud()).toEqual([publish()]);
    expect(
      screen.getAllByRole('button', { name: 'studio.action.publish' }),
    ).toHaveLength(1);
  });

  it('is loud and still for a scene never published', () => {
    card({ publishCall: 'ready' });
    expect(publish()).not.toHaveClass('subtle');
    expect(publish()).not.toHaveClass('is-beckoning');
  });

  it('is quiet with nothing to publish, and then nothing in the bar is loud', () => {
    card({ publishCall: 'quiet' });
    expect(publish()).toHaveClass('subtle');
    expect(publish()).not.toHaveClass('is-beckoning');
    expect(loud()).toEqual([]);
  });

  it('stops the light while publishing, while the scene cannot be sent, and while the window cannot be seen', () => {
    card({ publishCall: 'changes', publishing: true });
    expect(publish()).not.toHaveClass('is-beckoning');
    cleanup();
    card({ publishCall: 'changes', unfit: true });
    expect(publish()).not.toHaveClass('is-beckoning');
    cleanup();

    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      card({ publishCall: 'changes' });
      expect(publish()).not.toHaveClass('is-beckoning');
      // Shown again: the light comes back with the window.
      hidden.mockReturnValue(false);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(publish()).toHaveClass('is-beckoning');
    } finally {
      hidden.mockRestore();
    }
  });
});

it('offers no desktop on a computer that cannot put a visualizer there', async () => {
  card({ onSetDesktop: undefined });
  await userEvent.click(more());
  expect(
    screen.queryByRole('menuitem', { name: 'studio.action.desktop' }),
  ).toBeNull();
  expect(
    screen.getByRole('menuitem', { name: 'studio.action.export' }),
  ).toBeInTheDocument();
});

it('waits for a scene that plays before any of it', async () => {
  card({ unfit: true });
  expect(
    screen.getByRole('button', { name: 'studio.action.addToLooks' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'studio.action.publish' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'studio.action.playOnGraph' }),
  ).toBeDisabled();
  await userEvent.click(more());
  screen
    .getAllByRole('menuitem')
    .forEach((item) => expect(item).toBeDisabled());
});

it('shows the desktop being prepared, and does not start it twice', async () => {
  const props = card({ settingDesktop: true });
  await userEvent.click(more());
  const desktop = screen.getByRole('menuitem', {
    name: 'studio.action.desktop',
  });
  expect(desktop).toHaveAttribute('aria-busy', 'true');
  expect(desktop).toHaveClass('is-running');
  await userEvent.click(desktop);
  expect(props.onSetDesktop).not.toHaveBeenCalled();
});

it('says what an inspected FluidEQ scene is for, in place of every action', () => {
  render(<StudioShipInspect />);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('studio.inspect.title')).toBeInTheDocument();
});

// The menu closes on the press, so a running item is shown on More itself.
it('shows More running while the desktop is being prepared, and not otherwise', () => {
  card({ settingDesktop: true });
  expect(more()).toHaveClass('is-running');
  expect(more()).toHaveAttribute('aria-busy', 'true');
});

it('shows More at rest with nothing running', () => {
  card();
  expect(more()).not.toHaveClass('is-running');
});

/**
 * A scene that does not play yet — the stage keeps playing the last version
 * that worked — has "Put on desktop" off, and says why under it with the way
 * to its problems. Off and silent, a press on it did nothing anybody could
 * see (Ivan, 2026-11-10: "it is there but when I try to set the desktop
 * nothing happens").
 */
describe('putting a scene that does not play on the desktop', () => {
  it('is off, says why in plain words, and shows the problems from there', async () => {
    const props = card({ unfit: true, unfitReason: 'studio.unfit.noDaylight' });
    await userEvent.click(more());
    const desktop = screen.getByRole('menuitem', {
      name: 'studio.action.desktop',
    });
    expect(desktop).toBeDisabled();
    expect(desktop).toHaveAccessibleDescription('studio.unfit.lead');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'studio.unfit.show' }),
    );
    expect(props.onShowProblems).toHaveBeenCalledTimes(1);
    expect(props.onSetDesktop).not.toHaveBeenCalled();
  });

  // The control: a scene that plays — published or not — goes on.
  it('is on for a scene that plays, with nothing said under it', async () => {
    const props = card();
    await userEvent.click(more());
    expect(screen.queryByText('studio.unfit.lead')).toBeNull();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'studio.action.desktop' }),
    );
    expect(props.onSetDesktop).toHaveBeenCalledTimes(1);
  });

  it('says nothing for a scene that plays, whatever reason is left over', async () => {
    card({ unfit: false, unfitReason: 'studio.unfit.compile' });
    await userEvent.click(more());
    expect(
      screen.getByRole('menuitem', { name: 'studio.action.desktop' }),
    ).toBeEnabled();
    expect(screen.queryByText('studio.unfit.lead')).toBeNull();
  });

  it('says nothing while the scene is only still being built', async () => {
    card({ unfit: true, unfitReason: undefined });
    await userEvent.click(more());
    expect(
      screen.getByRole('menuitem', { name: 'studio.action.desktop' }),
    ).toBeDisabled();
    expect(screen.queryByText('studio.unfit.lead')).toBeNull();
  });
});
