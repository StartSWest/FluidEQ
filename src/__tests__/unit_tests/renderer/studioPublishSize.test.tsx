/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene's weight on the publish screen (Ivan, 2026-11-07: "show the full
 * size of the entire package and we limit to a reasonable size so we make
 * users optimize it"): the whole pack and each part measured as it is sent,
 * shown against the limit, and past it, said so with what to make smaller.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import {
  formatPackBytes,
  MAX_PUBLISH_BYTES,
  scenePackSize,
  tooLargeToPublish,
} from '../../../common/scenePackSize';
import StudioPublishSize from '../../../renderer/studio/StudioPublishSize';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const pack = (source: string, artwork?: string): IScenePack =>
  ({
    schema: 1,
    id: 'lake',
    version: 1,
    contract: 8,
    names: { en: 'Lake' },
    fallbackStyle: 'bars',
    swatch: ['#000000', '#ffffff'],
    source,
    params: [],
    ...(artwork ? { artwork: { width: 1, height: 1, data: artwork } } : {}),
  }) as unknown as IScenePack;

describe("a scene's weight", () => {
  it('is the whole pack as it is sent, its artwork apart from the rest', () => {
    const scene = pack('void main(){}', 'A'.repeat(1000));
    const size = scenePackSize(scene);
    expect(size.total).toBe(
      new TextEncoder().encode(JSON.stringify(scene)).length,
    );
    expect(size.artwork).toBeGreaterThan(1000);
    expect(size.models).toBe(0);
    expect(size.artwork + size.rest).toBe(size.total);
    expect(size.limit).toBe(MAX_PUBLISH_BYTES);
  });

  it('is too large to publish one byte past the limit, and not at it', () => {
    const base = scenePackSize(pack('')).total;
    expect(tooLargeToPublish(pack('x'.repeat(MAX_PUBLISH_BYTES - base)))).toBe(
      false,
    );
    expect(
      tooLargeToPublish(pack('x'.repeat(MAX_PUBLISH_BYTES - base + 1))),
    ).toBe(true);
  });

  it('reads in megabytes to one decimal where it counts', () => {
    expect(formatPackBytes(MAX_PUBLISH_BYTES, 'en')).toBe('5 MB');
    expect(formatPackBytes(4.8 * 1024 * 1024, 'en')).toBe('4.8 MB');
    expect(formatPackBytes(4.8 * 1024 * 1024, 'de')).toBe('4,8 MB');
    // Under a tenth of a megabyte "0 MB" says nothing.
    expect(formatPackBytes(12 * 1024, 'en')).toBe('12 KB');
    expect(formatPackBytes(10, 'en')).toBe('1 KB');
  });
});

describe('the publish screen', () => {
  it('shows the whole against the limit, and each part', () => {
    render(
      <StudioPublishSize
        size={{
          total: 3 * 1048576,
          artwork: 2.5 * 1048576,
          models: 0,
          rest: 0.5 * 1048576,
          limit: MAX_PUBLISH_BYTES,
        }}
      />,
    );
    expect(
      screen.getByText('studio.publish.sizeOf {"size":"3 MB","limit":"5 MB"}'),
    ).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      String(3 * 1048576),
    );
    expect(screen.getByText('studio.publish.sizeArtwork')).toBeInTheDocument();
    expect(screen.getByText('studio.publish.sizeCode')).toBeInTheDocument();
    // A part the scene does not have is not listed.
    expect(screen.queryByText('studio.publish.sizeModels')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('past the limit, says so and what to make smaller', () => {
    const { container } = render(
      <StudioPublishSize
        size={{
          total: 6 * 1048576,
          artwork: 5.5 * 1048576,
          models: 0,
          rest: 0.5 * 1048576,
          limit: MAX_PUBLISH_BYTES,
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.publish.tooLarge {"limit":"5 MB"}',
    );
    expect(container.querySelector('.studio-publish-size')).toHaveClass(
      'is-over',
    );
    expect(
      container.querySelector('.studio-publish-size__limit'),
    ).not.toBeNull();
  });
});
