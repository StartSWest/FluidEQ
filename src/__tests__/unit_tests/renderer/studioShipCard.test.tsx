/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio offers for a scene that plays: keeping it, publishing it,
 * sending it and putting it on the desktop, each as loud as it is common, and
 * none of it for a scene that does not play yet.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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

it('keeps the scene with the loud button, and publishes, sends and puts it on the desktop with quiet ones', async () => {
  const props = card();
  const add = screen.getByRole('button', { name: 'studio.action.addToLooks' });
  expect(add).toHaveClass('button', 'small');
  expect(add).not.toHaveClass('subtle');
  [
    'studio.action.publish',
    'studio.action.export',
    'studio.action.desktop',
  ].forEach((name) =>
    expect(screen.getByRole('button', { name })).toHaveClass('subtle'),
  );

  await userEvent.click(add);
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.action.desktop' }),
  );
  expect(props.onAdd).toHaveBeenCalledTimes(1);
  expect(props.onSetDesktop).toHaveBeenCalledTimes(1);
});

it('offers no desktop on a computer that cannot put a visualizer there', () => {
  card({ onSetDesktop: undefined });
  expect(
    screen.queryByRole('button', { name: 'studio.action.desktop' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'studio.action.export' }),
  ).toBeInTheDocument();
});

it('waits for a scene that plays before any of it', () => {
  card({ unfit: true });
  screen
    .getAllByRole('button')
    .forEach((button) => expect(button).toBeDisabled());
});

it('shows the desktop being prepared, and does not start it twice', async () => {
  const props = card({ settingDesktop: true });
  const desktop = screen.getByRole('button', { name: 'studio.action.desktop' });
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
