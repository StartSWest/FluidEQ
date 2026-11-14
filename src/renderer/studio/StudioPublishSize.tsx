/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { formatPackBytes, type IScenePackSize } from 'common/scenePackSize';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioPublishSize.scss';

/**
 * What the scene weighs as it will be published, against the most a member
 * may publish (Ivan, 2026-11-07: "show the full size of the entire package
 * and we limit to a reasonable size so we make users optimize it"): the
 * whole, a bar of its parts - the artwork, a world's models, the code and
 * settings - and, past the limit, what to make smaller. Every listener
 * downloads all of it to play the scene.
 */
export default function StudioPublishSize({ size }: { size: IScenePackSize }) {
  const { t, locale } = useTranslation();
  const over = size.total > size.limit;
  const format = (bytes: number) => formatPackBytes(bytes, locale);
  // Each part's share of the limit; past it, of the whole, so the bar fills.
  const scale = Math.max(size.limit, size.total);
  const share = (bytes: number): CSSProperties => ({
    width: `${(bytes / scale) * 100}%`,
  });
  const parts = [
    {
      key: 'artwork',
      bytes: size.artwork,
      label: t('studio.publish.sizeArtwork'),
    },
    {
      key: 'models',
      bytes: size.models,
      label: t('studio.publish.sizeModels'),
    },
    { key: 'rest', bytes: size.rest, label: t('studio.publish.sizeCode') },
  ].filter(({ bytes }) => bytes > 0);
  return (
    <section
      className={`studio-publish-size${over ? ' is-over' : ''}`}
      aria-labelledby="studio-publish-size-label"
      data-publish-part="size"
      // Nothing in it takes the focus, and a press on Send is sent here.
      tabIndex={-1}
    >
      <div className="studio-publish-size__head">
        <span className="gallery-dialog__label" id="studio-publish-size-label">
          {t('studio.publish.size')}
        </span>
        <span className="studio-publish-size__total">
          {t('studio.publish.sizeOf', {
            size: format(size.total),
            limit: format(size.limit),
          })}
        </span>
      </div>
      <div
        className="studio-publish-size__bar"
        role="meter"
        aria-labelledby="studio-publish-size-label"
        aria-valuemin={0}
        aria-valuemax={size.limit}
        aria-valuenow={Math.min(size.total, size.limit)}
        aria-valuetext={t('studio.publish.sizeOf', {
          size: format(size.total),
          limit: format(size.limit),
        })}
      >
        {parts.map(({ key, bytes }) => (
          <span
            key={key}
            className={`studio-publish-size__part is-${key}`}
            style={share(bytes)}
          />
        ))}
        {over && (
          <span
            className="studio-publish-size__limit"
            style={{ left: `${(size.limit / scale) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <ul className="studio-publish-size__legend">
        {parts.map(({ key, bytes, label }) => (
          <li key={key} className={`is-${key}`}>
            <span>{label}</span>
            <span className="studio-publish-size__bytes">{format(bytes)}</span>
          </li>
        ))}
      </ul>
      {over && (
        <p className="studio-publish-size__over" role="alert">
          {t('studio.publish.tooLarge', { limit: format(size.limit) })}
        </p>
      )}
    </section>
  );
}
