/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look editor's picture fit: "Whole picture" or "Tiled", and a tiled
 * picture's size — offered only while the texture is a picture, since a
 * pattern is a fixed 16-pixel material with no fit to choose.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
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
  const { texture = 'image', fit = 'tile', size = 192 } = props;
  const image = 'image' in props ? props.image : picture;
  render(
    <I18nProvider>
      <LookTextureRow
        texture={texture}
        image={image}
        fit={fit}
        size={size}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return onChange;
};

const fitButton = (key: 'look.texture.fit.cover' | 'look.texture.fit.tile') =>
  screen.queryByRole('button', { name: en[key] });

describe('the picture fit', () => {
  it('is offered for a picture, and the tile size only while tiled', () => {
    show();
    expect(fitButton('look.texture.fit.cover')).not.toBeNull();
    expect(
      fitButton('look.texture.fit.tile')?.getAttribute('aria-pressed'),
    ).toBe('true');
    const slider = screen.getByLabelText(en['look.texture.tileSize'], {
      exact: false,
    });
    expect((slider as HTMLInputElement).value).toBe('192');
  });

  it('hides the tile size over a whole picture', () => {
    show({ fit: 'cover' });
    expect(
      fitButton('look.texture.fit.cover')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.queryByLabelText(en['look.texture.tileSize'], { exact: false }),
    ).toBeNull();
  });

  it('is not offered for a pattern', () => {
    show({ texture: 'hatch' });
    expect(fitButton('look.texture.fit.cover')).toBeNull();
  });

  it('is not offered before a picture is chosen', () => {
    show({ image: undefined });
    expect(fitButton('look.texture.fit.cover')).toBeNull();
  });

  it('says what was chosen', () => {
    const onChange = show();
    fireEvent.click(fitButton('look.texture.fit.cover') as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith({ textureFit: 'cover' });
    fireEvent.change(
      screen.getByLabelText(en['look.texture.tileSize'], { exact: false }),
      { target: { value: '96' } },
    );
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
