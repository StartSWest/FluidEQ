/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import type { TranslationKey } from '../../../common/i18n';
import EditGlyph from '../../studio/edit/EditGlyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's Edit mode as it is from 2.5 (1ab18f597): one shape picked on
 * the stage, unlocked by the badge at its frame's corner, its two move arrows
 * carrying it along and back; the Move, Turn and Resize tools and Snap over
 * it, Discard and Save with their pictures at the other end. Beside it the
 * list, where everything starts locked: the picked one free and shown alone,
 * its group marked dimmer for holding it, and a light the scene's own file
 * switches off. Every word and picture is Edit mode's own.
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

interface IThing {
  kind: TranslationKey;
  number: number;
  /** Inside the group above it. */
  inner?: boolean;
  picked?: boolean;
  /** Holds the picked one: its solo mark shows, dimmer. */
  holds?: boolean;
  /** Switched off by the scene's own file. */
  off?: boolean;
}

const THINGS: readonly IThing[] = [
  { kind: 'studio.edit.kind.terrain', number: 1 },
  { kind: 'studio.edit.kind.group', number: 1, holds: true },
  { kind: 'studio.edit.kind.mesh', number: 3, inner: true, picked: true },
  { kind: 'studio.edit.kind.mesh', number: 4, inner: true },
  { kind: 'studio.edit.kind.instances', number: 2 },
  { kind: 'studio.edit.kind.model', number: 1 },
  { kind: 'studio.edit.kind.light', number: 1 },
  { kind: 'studio.edit.kind.light', number: 2, off: true },
];

const TOOLS: readonly TranslationKey[] = [
  'studio.edit.tool.move',
  'studio.edit.tool.turn',
  'studio.edit.tool.size',
];

const rowClass = (thing: IThing) =>
  [
    'edit-visual__row',
    thing.inner && 'is-inner',
    thing.picked && 'is-picked',
    thing.off && 'is-off',
  ]
    .filter(Boolean)
    .join(' ');

export default function StudioEditVisual() {
  const { t } = useTranslation();
  const name = (thing: IThing) =>
    t('studio.edit.unnamed', { kind: t(thing.kind), number: thing.number });
  const picked = THINGS.find((thing) => thing.picked) ?? THINGS[0];
  return (
    <div
      className="edit-visual"
      role="img"
      aria-label={t('tour.edit.imageAlt')}
    >
      <div className="edit-visual__stage">
        <img className="edit-visual__scene" src={neonCity} alt="" />
        <span className="edit-visual__bar">
          <span className="edit-visual__tools">
            {TOOLS.map((tool, index) => (
              <span
                key={tool}
                className={`edit-visual__tool${index === 0 ? ' is-on' : ''}`}
              >
                {t(tool)}
              </span>
            ))}
            <span className="edit-visual__tool edit-visual__snap">
              {t('studio.edit.snap')}
            </span>
          </span>
          <span className="edit-visual__keep">
            <span className="edit-visual__discard">
              <EditGlyph name="discard" />
              {t('studio.edit.discard')}
            </span>
            <span className="edit-visual__save">
              <EditGlyph name="save" />
              {t('studio.edit.save')}
            </span>
          </span>
        </span>
        <span className="edit-visual__pick">
          <span className="edit-visual__frame">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="edit-visual__badge">
            <EditGlyph name="unlock" />
          </span>
          <svg
            className="edit-visual__arrows"
            viewBox="0 0 40 40"
            aria-hidden="true"
          >
            <path
              className="edit-visual__arrow-x"
              d="M20 20 H36 M31 15 L36 20 L31 25"
            />
            <path
              className="edit-visual__arrow-y"
              d="M20 20 V4 M15 9 L20 4 L25 9"
            />
            <circle cx="20" cy="20" r="2.6" />
          </svg>
          <span className="edit-visual__name">{name(picked)}</span>
        </span>
      </div>

      <div className="edit-visual__list">
        <span className="edit-visual__list-title">
          {t('studio.edit.list.title')}
        </span>
        {THINGS.map((thing) => (
          <span
            key={`${thing.kind}-${thing.number}`}
            className={rowClass(thing)}
          >
            <i className="edit-visual__dot" />
            <span className="edit-visual__row-name">
              {name(thing)}
              {thing.off && <small>{t('studio.edit.offInScene')}</small>}
            </span>
            <span className="edit-visual__flags">
              {(thing.picked || thing.holds) && (
                <span
                  className={`edit-visual__flag is-solo${
                    thing.holds ? ' is-inside' : ''
                  }`}
                >
                  <EditGlyph name="solo" />
                </span>
              )}
              <span
                className={`edit-visual__flag${thing.picked ? ' is-free' : ''}`}
              >
                <EditGlyph name={thing.picked ? 'unlock' : 'lock'} />
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
