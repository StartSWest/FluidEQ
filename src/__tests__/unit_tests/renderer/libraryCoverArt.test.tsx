/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { cleanup, render } from '@testing-library/react';
import { libraryMediaUrl, librarySizedArtUrl } from 'common/library/mediaUrl';
import LibraryCoverArt, {
  type TLibraryCoverArtSize,
} from 'renderer/library/LibraryCoverArt';

/**
 * Each size of cover asks for the picture it draws. Measured over 14,000
 * songs before this: a row of the Songs list drew 30 to 36 CSS pixels from
 * the 320 cover and decoded 61 times the pixels it showed; after it, 6.
 */

const ART_ID = 'a1b2c3d4';

const imageOf = (
  size: TLibraryCoverArtSize,
  over: { src?: string; artId?: string } = { artId: ART_ID },
): HTMLImageElement => {
  const { container } = render(
    <LibraryCoverArt
      label="Kind of Blue"
      size={size}
      src={over.src}
      artId={over.artId}
    />,
  );
  const image = container.querySelector('img');
  if (image === null) {
    throw new Error(`expected the ${size} cover to draw an image`);
  }
  return image;
};

afterEach(cleanup);

describe('the picture each cover asks for', () => {
  it('a row takes the small picture and offers nothing larger', () => {
    const image = imageOf('row');
    expect(image.getAttribute('src')).toBe(librarySizedArtUrl(ART_ID, 'small'));
    expect(image.hasAttribute('srcset')).toBe(false);
    expect(image.hasAttribute('sizes')).toBe(false);
  });

  it('a tile offers the medium picture beside the cover, for 160 pixels', () => {
    const image = imageOf('tile');
    expect(image.getAttribute('srcset')).toBe(
      `${librarySizedArtUrl(ART_ID, 'medium')} 224w, ${libraryMediaUrl('art', ART_ID)} 320w`,
    );
    expect(image.getAttribute('sizes')).toBe('160px');
    // The fallback for a browser that reads no srcset is the cover itself.
    expect(image.getAttribute('src')).toBe(libraryMediaUrl('art', ART_ID));
  });

  it('a cover is drawn larger than a tile and keeps the full picture', () => {
    const image = imageOf('cover');
    expect(image.getAttribute('src')).toBe(libraryMediaUrl('art', ART_ID));
    expect(image.hasAttribute('srcset')).toBe(false);
    expect(image.hasAttribute('sizes')).toBe(false);
  });

  it('draws a picture it was handed as it is, at every size', () => {
    // The karaoke session's and the Media tab's pictures are not in the
    // library's cache and have no smaller copies; asking for one would draw
    // nothing. They win over an art id given beside them.
    const handed = 'blob:fluideq/1234';
    (['row', 'tile', 'cover'] as const).forEach((size) => {
      const image = imageOf(size, { src: handed, artId: ART_ID });
      expect(image.getAttribute('src')).toBe(handed);
      expect(image.hasAttribute('srcset')).toBe(false);
      cleanup();
    });
  });

  it('draws the generated tile, and asks for nothing, with no picture', () => {
    const { container } = render(
      <LibraryCoverArt label="Kind of Blue" size="row" />,
    );
    expect(container.querySelector('img')).toBeNull();
    // The first letter of each of the first two words.
    expect(
      container.querySelector('.library-cover-art__tile')?.textContent,
    ).toBe('KO');
  });
});
