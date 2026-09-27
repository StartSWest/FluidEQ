/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio's bar offers for a scene that plays: keeping it, the loud
 * one, publishing it, and behind More sending it and putting it on the
 * desktop — each as loud as it is common, and none of it for a scene that
 * does not play yet.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioShipCard from '../../../renderer/studio/StudioShipCard';
import StudioShipInspect from '../../../renderer/studio/StudioShipInspect';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const card = (
  overrides: Partial<Parameters<typeof StudioShipCard>[0]> = {},
) => {
  const props = {
    unfit: false,
    onAdd: jest.fn(),
    publishing: false,
    onPublish: jest.fn(),
    exporting: false,
    onExport: jest.fn(),
    onSetDesktop: jest.fn(),
    settingDesktop: false,
    ...overrides,
  };
  render(
    <StudioShipCard
      unfit={props.unfit}
      onAdd={props.onAdd}
      publishing={props.publishing}
      onPublish={props.onPublish}
      exporting={props.exporting}
      onExport={props.onExport}
      onSetDesktop={props.onSetDesktop}
      settingDesktop={props.settingDesktop}
    />,
  );
  return props;
};

const more = () => screen.getByRole('button', { name: 'studio.ship.more' });

it('keeps the scene with the loud button, publishes with a quiet one, and sends it or puts it on the desktop from More', async () => {
  const props = card();
  const bar = screen.getByRole('group', { name: 'studio.ship.title' });
  const add = within(bar).getByRole('button', {
    name: 'studio.action.addToLooks',
  });
  expect(add).toHaveClass('button', 'small');
  expect(add).not.toHaveClass('subtle');
  expect(
    within(bar).getByRole('button', { name: 'studio.action.publish' }),
  ).toHaveClass('subtle');
  expect(more()).toHaveClass('subtle');
  expect(more()).toHaveAttribute('aria-expanded', 'false');
  // Sending and the desktop wait behind More: the bar has one loud action.
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
  expect(props.onAdd).toHaveBeenCalledTimes(1);
  expect(props.onSetDesktop).toHaveBeenCalledTimes(1);
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
