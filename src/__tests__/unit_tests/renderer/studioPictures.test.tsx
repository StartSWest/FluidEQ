/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_FRAMING } from '../../../common/pictureFraming';
import type {
  IStudioPicture,
  TStudioPictures,
} from '../../../main/ipc/studioPictures';
import StudioPictures from '../../../renderer/studio/StudioPictures';
import type { IPicturePreview } from '../../../renderer/studio/useScenePictures';

jest.mock('../../../renderer/studio/scenePicture', () => ({
  decodePicture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

type TAtlas = Extract<TStudioPictures, { kind: 'atlas' }>;

const image = new Uint8Array([1, 2, 3]);

const slot = (
  id: string,
  x: number,
  names?: IStudioPicture['names'],
): IStudioPicture => ({
  id,
  names,
  x,
  y: 0,
  width: 100,
  height: 100,
  framing: DEFAULT_FRAMING,
  framed: DEFAULT_FRAMING,
  hasPhoto: false,
});

const piece = (id: string, x: number) => ({
  id,
  x,
  y: 100,
  width: 100,
  height: 100,
  rotated: false,
});

const atlas: TAtlas = {
  kind: 'atlas',
  width: 300,
  height: 200,
  pictures: [
    slot('hero', 0, { en: 'Hero' }),
    slot('logo', 100),
    slot('sign', 200),
  ],
  regions: [piece('sky', 0), piece('boat', 100), piece('sun', 200)],
  image,
};

/** `logo` is empty, so the viewer's set is `Hero` and the third picture. */
const previews: Record<string, IPicturePreview> = {
  hero: { url: 'blob:hero', filled: true },
  logo: { filled: false },
  sign: { url: 'blob:sign', filled: true },
};

const Card = ({ pictures }: { pictures: TAtlas }) => (
  <StudioPictures pictures={pictures} previews={previews} onOpen={jest.fn()} />
);

const view = (name: string) =>
  screen.findByRole('button', { name: `studio.picture.view:${name}` });

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => 'blob:atlas');
  URL.revokeObjectURL = jest.fn();
  // Electron has it; jsdom does not. The viewer's strip scrolls to the
  // picture shown.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
});

it('opens a separate piece on that piece, steps through the pieces, and gives focus back to its tile', async () => {
  const user = userEvent.setup();
  render(<Card pictures={atlas} />);
  await user.click(screen.getByText('studio.picture.separate:3'));
  const boat = await view('boat');
  await user.click(boat);

  expect(screen.getByRole('dialog', { name: 'boat' })).toBeVisible();
  expect(screen.getByText('studio.picture.position:2,3')).toBeVisible();

  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('dialog', { name: 'sun' })).toBeVisible();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('dialog', { name: 'sky' })).toBeVisible();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(boat).toHaveFocus();
});

it('opens a picture among the filled pictures only', async () => {
  const user = userEvent.setup();
  render(<Card pictures={atlas} />);
  // An empty picture has nothing to show, so nothing to open.
  expect(await view('Hero')).toBeVisible();
  expect(
    screen.queryByRole('button', {
      name: 'studio.picture.view:studio.picture.unnamed:2',
    }),
  ).not.toBeInTheDocument();

  await user.click(await view('studio.picture.unnamed:3'));
  expect(
    screen.getByRole('dialog', { name: 'studio.picture.unnamed:3' }),
  ).toBeVisible();
  expect(screen.getByText('studio.picture.position:2,2')).toBeVisible();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('dialog', { name: 'Hero' })).toBeVisible();
});

it('closes the viewer when a re-read no longer has its piece, and leaves it closed when the piece comes back', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Card pictures={atlas} />);
  await user.click(screen.getByText('studio.picture.separate:3'));
  await user.click(await view('boat'));
  expect(screen.getByRole('dialog', { name: 'boat' })).toBeVisible();

  // Positive control: a re-read that still has the piece keeps it open.
  rerender(
    <Card pictures={{ ...atlas, regions: [...(atlas.regions ?? [])] }} />,
  );
  expect(screen.getByRole('dialog', { name: 'boat' })).toBeVisible();

  rerender(
    <Card
      pictures={{
        ...atlas,
        regions: atlas.regions?.filter((region) => region.id !== 'boat'),
      }}
    />,
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  rerender(<Card pictures={atlas} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
