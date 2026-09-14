/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio offers for a scene that plays: keeping it, publishing it
 * and sending it, each as loud as it is common, and none of it for a scene
 * that does not play yet.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioShipCard from '../../../renderer/studio/StudioShipCard';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const card = (
  overrides: Partial<Parameters<typeof StudioShipCard>[0]> = {},
) => {
  const props = {
    inspecting: false,
    unfit: false,
    onAdd: jest.fn(),
    publishing: false,
    onPublish: jest.fn(),
    exporting: false,
    onExport: jest.fn(),
    ...overrides,
  };
  render(
    <StudioShipCard
      inspecting={props.inspecting}
      unfit={props.unfit}
      onAdd={props.onAdd}
      publishing={props.publishing}
      onPublish={props.onPublish}
      exporting={props.exporting}
      onExport={props.onExport}
    />,
  );
  return props;
};

it('keeps the scene with the loud button, and publishes and sends it with quiet ones', async () => {
  const props = card();
  const add = screen.getByRole('button', { name: 'studio.action.addToLooks' });
  expect(add).toHaveClass('button', 'small');
  expect(add).not.toHaveClass('subtle');
  ['studio.action.publish', 'studio.action.export'].forEach((name) =>
    expect(screen.getByRole('button', { name })).toHaveClass('subtle'),
  );

  await userEvent.click(add);
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.action.export' }),
  );
  expect(props.onAdd).toHaveBeenCalledTimes(1);
  expect(props.onExport).toHaveBeenCalledTimes(1);
});

it('waits for a scene that plays before any of it', () => {
  card({ unfit: true });
  screen
    .getAllByRole('button')
    .forEach((button) => expect(button).toBeDisabled());
});

it('does not start an export already under way', async () => {
  const props = card({ exporting: true });
  const send = screen.getByRole('button', { name: 'studio.action.export' });
  expect(send).toHaveAttribute('aria-busy', 'true');
  await userEvent.click(send);
  expect(props.onExport).not.toHaveBeenCalled();
});

it('says what an inspected FluidEQ scene is for, in place of every action', () => {
  card({ inspecting: true });
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('studio.inspect.title')).toBeInTheDocument();
});
