/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Sharing a preset as a link or to the community waits for 2.7 (Ivan,
 * 2026-11-23: "oculta compartir presets"): the tile's menu offers Export and
 * not the two, and its quick action beside the star opens the export. Every
 * other entry of the menu stays, the control that the filter took nothing
 * else.
 */

jest.mock('../../../renderer/eq/presetCard/PresetCardCurve', () => () => null);
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IDspCatalogEntry } from '../../../renderer/dsp/dspPresetCatalog';
import OwnPresetTile from '../../../renderer/eq/ownPresets/OwnPresetTile';
import type { IPresetCurveDesign } from '../../../renderer/eq/presetCard/presetCardDrawing';
/* eslint-enable import/first */

const handlers = () => ({
  onToggleStar: jest.fn(),
  onApply: jest.fn(),
  onPoint: jest.fn(),
  onEdit: jest.fn(),
  onRenameStart: jest.fn(),
  onRenameEnd: jest.fn(),
  onDuplicate: jest.fn(),
  onAskDelete: jest.fn(),
  onShare: jest.fn(),
  onCopyLink: jest.fn(),
  onExport: jest.fn(),
});

const open = () => {
  const on = handlers();
  render(
    <OwnPresetTile
      preset={
        { id: 'mine', name: 'Night drive' } as unknown as IDspCatalogEntry
      }
      curveDesign={{} as IPresetCurveDesign}
      hint="Your preset"
      isPlaying={false}
      isDisabled={false}
      isRenaming={false}
      isFavourite={false}
      starLabel="Star"
      onToggleStar={on.onToggleStar}
      onApply={on.onApply}
      onPoint={on.onPoint}
      onEdit={on.onEdit}
      onRenameStart={on.onRenameStart}
      onRenameEnd={on.onRenameEnd}
      onDuplicate={on.onDuplicate}
      onAskDelete={on.onAskDelete}
      onShare={on.onShare}
      onCopyLink={on.onCopyLink}
      onExport={on.onExport}
    />,
  );
  return on;
};

it('offers Export and none of the links in the tile’s menu', () => {
  open();
  fireEvent.click(
    screen.getByRole('button', { name: 'eq.own.more:Night drive' }),
  );
  const offered = screen
    .getAllByRole('menuitem')
    .map((item) => item.textContent);
  expect(offered).toEqual(
    expect.arrayContaining([
      'eq.own.edit',
      'myCurves.rename',
      'myCurves.duplicate',
      'presetShare.menu.export',
      'myCurves.delete',
    ]),
  );
  expect(offered).not.toContain('presetShare.menu.community');
  expect(offered).not.toContain('presetShare.menu.copyLink');
});

it('opens the export from the quick action beside the star', () => {
  const on = open();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'presetShare.export.title:Night drive',
    }),
  );
  expect(on.onExport).toHaveBeenCalledTimes(1);
  expect(on.onShare).not.toHaveBeenCalled();
});
