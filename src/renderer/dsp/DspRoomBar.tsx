/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IRoomSettings } from '../../common/dsp/chain';
import {
  IRoomPreset,
  isRoomPresetId,
  ROOM_PRESET_LIST,
  roomPresetSettings,
} from '../../common/dsp/roomPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspRoomBarProps {
  room: IRoomSettings;
  onChange: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/**
 * The rooms, presented with the same picker as the EQ, the Exciter and the
 * Dimension stage: a menu grouped like theirs, the previous/next arrows for
 * auditioning, and Reset to the living room the dials describe by default.
 * The hint under each name is derived from the room's own numbers, so a
 * room retuned later never carries a stale sentence.
 *
 * Choosing a room here switches the stage on as well, as choosing a profile
 * on the other stages does.
 */
const DspRoomBar = ({ room, onChange, onCommit }: IDspRoomBarProps) => {
  const { t } = useTranslation();
  const hint = (preset: IRoomPreset) =>
    t('dsp.room.presetHint', {
      size: preset.shape.sizeM.toFixed(1),
      distance: preset.shape.distanceM.toFixed(1),
      live: String(Math.round((1 - preset.shape.walls) * 100)),
    });
  const entries: IRichPickEntry[] = ROOM_PRESET_LIST.map((preset) => ({
    id: preset.id,
    name: t(preset.labelKey as TranslationKey),
    hint: hint(preset),
    group: preset.group,
    icon: <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />,
  }));
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string) => {
    if (!isRoomPresetId(id)) {
      return;
    }
    onChange({ ...roomPresetSettings(room, id), enabled: true });
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    const current = ordered.indexOf(room.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-room-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={room.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.room.presets')}
          triggerTitle={t('dsp.room.presets')}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
          title={t('dsp.eqPreset.previous')}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.next')}
          title={t('dsp.eqPreset.next')}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>

      {/* Reset goes to the living room: the room the dials' defaults describe,
          and the one the card opens on. */}
      <div className="dsp-eq-transfer">
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            onChange(roomPresetSettings(room, 'livingRoom'));
            onCommit();
          }}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
      </div>
    </div>
  );
};

export default DspRoomBar;
