/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { findPresetShareCode } from '../../common/presetShare/presetShareCode';
import type { ErrorDescription } from '../../common/errors';
import PresetShareCard from '../eq/ownPresets/share/PresetShareCard';
import useAddSharedPreset from '../eq/ownPresets/share/useAddSharedPreset';
import usePresetTrial from '../eq/ownPresets/share/usePresetTrial';
import useSharedPreset from '../eq/ownPresets/share/useSharedPreset';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';

interface IPostPresetCardProps {
  /** The post's HTML as GitHub rendered it: only its code is read. */
  html: string;
  author: string;
}

/**
 * The preset a post carries, as a card under the post with Add to my presets
 * (Ivan, 2026-11-20: importing from a forum post with one press).
 *
 * Found by its share code anywhere in the post — the fenced block Share
 * writes, or a link to fluideq.com/p pasted by hand — and drawn from the
 * code alone: the post's HTML is somebody else's writing and decides
 * nothing here but whether there is a code in it.
 */
const PresetInPost = ({ html, author }: IPostPresetCardProps) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqLayers();
  const read = useSharedPreset(html);
  const add = useAddSharedPreset();
  const trial = usePresetTrial();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');

  if (!read) {
    return null;
  }
  if (!read.ok) {
    // Still unpacking: nothing yet rather than a box that jumps. A code
    // this FluidEQ cannot read says why, under the post it came in.
    return read.problem === 'newer' || read.problem === 'damaged' ? (
      <p className="preset-share-card__problem">
        {t(
          read.problem === 'newer'
            ? 'presetShare.import.newer'
            : 'presetShare.import.damaged',
        )}
      </p>
    ) : null;
  }
  const { preset } = read;
  return (
    <PresetShareCard
      name={preset.name}
      settings={preset.settings}
      curve={preset.curve}
      byline={t('presetShare.card.by', { author })}
    >
      <button
        type="button"
        className={`button small${state === 'adding' ? ' is-running' : ''}`}
        disabled={state !== 'idle'}
        onClick={() => {
          setState('adding');
          // Kept: what the trial would have put back is replaced by it.
          trial.forget();
          add(preset)
            .then(() => {
              setState('added');
              return true;
            })
            .catch((error: unknown) => {
              setState('idle');
              setGlobalError(error as ErrorDescription);
            });
        }}
      >
        <MenuIcon name={state === 'added' ? 'check' : 'download'} />
        {state === 'added'
          ? t('presetShare.card.added')
          : t('presetShare.card.add')}
      </button>
      {state !== 'added' && trial.canTry && (
        <button
          type="button"
          className="button small subtle"
          aria-pressed={trial.isTrying}
          disabled={state === 'adding'}
          onClick={() => {
            if (trial.isTrying) {
              trial.stop();
            } else {
              trial.start(preset).catch(() => undefined);
            }
          }}
        >
          <MenuIcon name={trial.isTrying ? 'stop' : 'play'} />
          {trial.isTrying
            ? t('presetShare.card.stopTrying')
            : t('presetShare.card.try')}
        </button>
      )}
      {trial.isTrying && (
        <span className="preset-share-card__note">
          {t('presetShare.card.tryingNote')}
        </span>
      )}
    </PresetShareCard>
  );
};

const PostPresetCard = ({ html, author }: IPostPresetCardProps) =>
  // Most posts carry none: they hold no rack subscription and no trial.
  findPresetShareCode(html) ? (
    <PresetInPost html={html} author={author} />
  ) : null;

export default PostPresetCard;
