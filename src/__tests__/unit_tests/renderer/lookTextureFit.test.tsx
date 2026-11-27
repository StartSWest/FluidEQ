/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look editor's picture fit — "Whole picture" or "Tiled" — and the one
 * "Tile size" slider: a tiled picture's height, or a pattern's tile side
 * (Ivan, 2026-11-27: "a slider to grow the tile", as the picture has). The
 * fit is a picture's alone; a pattern always tiles. Each texture kind moves
 * a size of its own.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import {
  MAX_PATTERN_SIZE,
  MAX_TEXTURE_SIZE,
  MIN_PATTERN_SIZE,
  MIN_TEXTURE_SIZE,
} from 'common/graphTextures';
import LookTextureRow from '../../../renderer/components/LookTextureRow';
import { I18nProvider } from '../../../renderer/utils/I18nContext';

jest.mock('../../../renderer/graph/textureUpload', () => {
  class TextureError extends Error {
    readonly reason = 'unreadable';
  }
  return {
    TextureError,
    tileFromFile: jest.fn(() =>
      Promise.resolve(`data:image/webp;base64,${'B'.repeat(16)}`),
    ),
  };
});

const picture = `data:image/webp;base64,${'A'.repeat(16)}`;

const show = (props: Partial<Parameters<typeof LookTextureRow>[0]> = {}) => {
  const onChange = jest.fn();
  const {
    texture = 'image',
    fit = 'tile',
    pictureSize = 192,
    patternSize = 16,
  } = props;
  const image = 'image' in props ? props.image : picture;
  render(
    <I18nProvider>
      <LookTextureRow
        texture={texture}
        image={image}
        fit={fit}
        pictureSize={pictureSize}
        patternSize={patternSize}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return onChange;
};

const fitButton = (key: 'look.texture.fit.cover' | 'look.texture.fit.tile') =>
  screen.queryByRole('button', { name: en[key] });

const tileSlider = () =>
  screen.queryByLabelText(en['look.texture.tileSize'], {
    exact: false,
  }) as HTMLInputElement | null;

describe('the picture fit', () => {
  it('is offered for a picture, and the tile size only while tiled', () => {
    show();
    expect(fitButton('look.texture.fit.cover')).not.toBeNull();
    expect(
      fitButton('look.texture.fit.tile')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(tileSlider()?.value).toBe('192');
  });

  it('hides the tile size over a whole picture', () => {
    show({ fit: 'cover' });
    expect(
      fitButton('look.texture.fit.cover')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(tileSlider()).toBeNull();
  });

  it('is not offered for a pattern', () => {
    show({ texture: 'hatch' });
    expect(fitButton('look.texture.fit.cover')).toBeNull();
  });

  it('is not offered before a picture is chosen', () => {
    show({ image: undefined });
    expect(fitButton('look.texture.fit.cover')).toBeNull();
    expect(tileSlider()).toBeNull();
  });

  it('says what was chosen', () => {
    const onChange = show();
    fireEvent.click(fitButton('look.texture.fit.cover') as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith({ textureFit: 'cover' });
    fireEvent.change(tileSlider() as HTMLElement, { target: { value: '96' } });
    expect(onChange).toHaveBeenLastCalledWith({ textureSize: 96 });
  });

  it('lays a first picture over the whole figure and keeps the fit of a replaced one', async () => {
    const first = show({ texture: 'none', image: undefined });
    const input = document.querySelector('input[type="file"]') as HTMLElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByRole('group', { name: en['look.textureStyle'] });
    await Promise.resolve();
    await Promise.resolve();
    expect(first).toHaveBeenLastCalledWith(
      expect.objectContaining({ texture: 'image', textureFit: 'cover' }),
    );
  });

  it('keeps the fit when a picture is replaced', async () => {
    const replaced = show();
    const input = document.querySelector('input[type="file"]') as HTMLElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await Promise.resolve();
    await Promise.resolve();
    const [last] = replaced.mock.calls[replaced.mock.calls.length - 1];
    expect(last).toMatchObject({ texture: 'image' });
    expect(last).not.toHaveProperty('textureFit');
  });
});

describe("a pattern's tile size", () => {
  it.each(['hatch', 'dots', 'static'] as const)(
    'is offered for %s, at the pattern size and range, under the same name',
    (texture) => {
      show({ texture, patternSize: 40, pictureSize: 320 });
      const slider = tileSlider();
      expect(slider?.value).toBe('40');
      expect(slider?.min).toBe(String(MIN_PATTERN_SIZE));
      expect(slider?.max).toBe(String(MAX_PATTERN_SIZE));
      // The same control as the picture's, drawn and labelled the same.
      expect(slider?.className).toBe('look-designer__slider');
      expect(screen.getByText('40 px')).not.toBeNull();
    },
  );

  it('moves the pattern size and never the picture one', () => {
    const onChange = show({ texture: 'hatch' });
    fireEvent.change(tileSlider() as HTMLElement, { target: { value: '64' } });
    expect(onChange).toHaveBeenLastCalledWith({ patternSize: 64 });
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ textureSize: expect.anything() }),
    );
  });

  it("is the picture's range and size again for a tiled picture", () => {
    // The control for the two above: the same slider over a picture moves
    // the picture's size, in the picture's range.
    show({ texture: 'image', patternSize: 40, pictureSize: 320 });
    const slider = tileSlider();
    expect(slider?.value).toBe('320');
    expect(slider?.min).toBe(String(MIN_TEXTURE_SIZE));
    expect(slider?.max).toBe(String(MAX_TEXTURE_SIZE));
  });

  it('is not offered on a plain fill', () => {
    show({ texture: 'none' });
    expect(tileSlider()).toBeNull();
  });
});
