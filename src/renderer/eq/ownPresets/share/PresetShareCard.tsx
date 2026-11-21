/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ReactNode } from 'react';
import type { IDspSettings, IEqSettings } from '../../../../common/dsp/chain';
import VoicingIcon from '../../../icons/VoicingIcon';
import { useTranslation } from '../../../utils/I18nContext';
import PresetCurveSpark from '../PresetCurveSpark';
import { rackStageNames } from './presetShareText';

interface IPresetShareCardProps {
  name: string;
  settings: IDspSettings;
  curve?: IEqSettings;
  /** The line under the name: who shared it, or where it came from. */
  byline?: string;
  /** The card's own end: a remove button in a post being written. */
  aside?: ReactNode;
  /** The presses under it: Add to my presets, and so on. */
  children?: ReactNode;
}

/**
 * A shared preset as somebody about to take it sees it: its name, its curve
 * as it plays, and the rack's stages as chips. The same card in a post being
 * written, a post being read, the export and the import, so a preset looks
 * like itself wherever it travels.
 *
 * Drawn from the preset's own numbers, read and clamped
 * (`readPresetShareCode`), never from a post's HTML.
 */
const PresetShareCard = ({
  name,
  settings,
  curve,
  byline,
  aside,
  children,
}: IPresetShareCardProps) => {
  const { t } = useTranslation();
  const bands = curve?.bands.filter((band) => band.enabled).length ?? 0;
  const stages = rackStageNames(settings, t);
  return (
    <div className="preset-share-card">
      <div className="preset-share-card__head">
        <VoicingIcon className="preset-share-card__glyph" />
        <span className="preset-share-card__words">
          <strong>{name}</strong>
          {byline && <span>{byline}</span>}
        </span>
        {aside}
      </div>
      {bands > 0 && <PresetCurveSpark curve={curve} size="wide" />}
      <ul className="preset-share-card__stages">
        {bands > 0 && (
          <li className="preset-share-card__chip is-curve">
            {t('presetShare.chip.curve', { count: bands })}
          </li>
        )}
        {stages.map((stage) => (
          <li key={stage} className="preset-share-card__chip">
            {stage}
          </li>
        ))}
        {bands === 0 && stages.length === 0 && (
          <li className="preset-share-card__chip">
            {t('presetShare.chip.flat')}
          </li>
        )}
      </ul>
      {children && <div className="preset-share-card__actions">{children}</div>}
    </div>
  );
};

export default PresetShareCard;
