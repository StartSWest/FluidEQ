/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's Edit mode on a scene the app draws: one shape picked on the
 * stage, its frame and its two move arrows carrying it along and back, the
 * Move, Turn and Resize tools and Snap over it, Discard and Save at the other
 * end; beside it the list of what is in the scene, the picked one marked
 * Solo. Every word is the Edit mode's own label.
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

interface IThing {
  kind: TranslationKey;
  number: number;
  /** Inside the group above it. */
  inner?: boolean;
  picked?: boolean;
}

const THINGS: readonly IThing[] = [
  { kind: 'studio.edit.kind.terrain', number: 1 },
  { kind: 'studio.edit.kind.group', number: 1 },
  { kind: 'studio.edit.kind.mesh', number: 3, inner: true, picked: true },
  { kind: 'studio.edit.kind.mesh', number: 4, inner: true },
  { kind: 'studio.edit.kind.instances', number: 2 },
  { kind: 'studio.edit.kind.model', number: 1 },
  { kind: 'studio.edit.kind.light', number: 1 },
];

const TOOLS: readonly TranslationKey[] = [
  'studio.edit.tool.move',
  'studio.edit.tool.turn',
  'studio.edit.tool.size',
];

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
              {t('studio.edit.discard')}
            </span>
            <span className="edit-visual__save">{t('studio.edit.save')}</span>
          </span>
        </span>
        <span className="edit-visual__pick">
          <span className="edit-visual__frame">
            <i />
            <i />
            <i />
            <i />
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
            className={`edit-visual__row${thing.inner ? ' is-inner' : ''}${
              thing.picked ? ' is-picked' : ''
            }`}
          >
            <i className="edit-visual__dot" />
            <span className="edit-visual__row-name">{name(thing)}</span>
            {thing.picked && (
              <span className="edit-visual__solo">{t('studio.edit.solo')}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
