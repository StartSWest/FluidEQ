/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  USER_DSP_PRESET_NAME_MAX,
  uniqueUserPresetName,
} from '../../../common/userPresetsFile';
import type { TranslationKey } from '../../../common/i18n/en';
import DialogFrame from '../../components/DialogFrame';
import { useDspSettings } from '../../dsp/store';
import { newUserPresetId, readUserDspPresets } from '../../dsp/userDspPresets';
import MenuIcon from '../../icons/MenuIcon';
import { useFluidEqContext } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import {
  newPresetStarts,
  type TCurveStart,
  type TRackStart,
} from './newPresetStart';
import { closeNewPresetDialog } from './newPresetDialogState';
import PresetCurveSpark from './PresetCurveSpark';
import usePresetEditActions from './usePresetEditActions';

const CURVE_ORDER: readonly TCurveStart[] = ['playing', 'yours', 'flat'];
const RACK_ORDER: readonly TRackStart[] = ['playing', 'now', 'empty'];

const RACK_LABEL: Record<Exclude<TRackStart, 'playing'>, TranslationKey> = {
  now: 'eq.own.rackNow',
  empty: 'eq.own.rackEmpty',
};

/**
 * New preset (Ivan, 2026-11-20, own presets, Direction A): a name, where its
 * curve starts — the preset playing, Your EQ, or flat — and where its rack
 * starts, then the EQ page opens on the curve to be shaped. What it starts
 * from is read once as it opens, so a preset that changes underneath does
 * not change the choices while they are being made.
 */
const NewPresetDialog = () => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { voicing, filters } = useFluidEqContext();
  const { begin } = usePresetEditActions();
  const [starts] = useState(() =>
    newPresetStarts(settings, voicing, filters, t),
  );
  const taken = readUserDspPresets().map((preset) => preset.name);
  const [name, setName] = useState(() =>
    uniqueUserPresetName(
      starts.playingName
        ? t('eq.own.defaultFrom', { name: starts.playingName })
        : t('eq.own.defaultName'),
      taken,
    ),
  );
  const [curveStart, setCurveStart] = useState<TCurveStart>(
    () => CURVE_ORDER.find((one) => starts.curves[one]) ?? 'flat',
  );
  const [rackStart, setRackStart] = useState<TRackStart>(
    () => RACK_ORDER.find((one) => starts.racks[one]) ?? 'now',
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();

  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeNewPresetDialog();
    }
  });
  useEffect(() => {
    inputRef.current?.select();
    const onKey = (event: KeyboardEvent) => closeOnEscape(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trimmed = name.trim();
  const curve = starts.curves[curveStart];
  const rack = starts.racks[rackStart];
  const create = () => {
    if (trimmed === '' || !curve || !rack) {
      return;
    }
    closeNewPresetDialog();
    begin({
      presetId: newUserPresetId(),
      name: uniqueUserPresetName(trimmed, taken),
      isNew: true,
      curve,
      rack,
    });
  };

  const curveLabel = (one: TCurveStart) => {
    if (one === 'playing') {
      return t('eq.own.fromPlaying', { name: starts.playingName ?? '' });
    }
    return one === 'yours' ? t('eq.tabs.bands') : t('eq.own.flat');
  };
  const rackLabel = (one: TRackStart) =>
    one === 'playing'
      ? t('eq.own.rackOf', { name: starts.playingName ?? '' })
      : t(RACK_LABEL[one]);

  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeNewPresetDialog();
        }
      }}
    >
      <DialogFrame
        className="own-preset-dialog"
        icon={<MenuIcon name="filePlus" />}
        title={t('eq.own.new')}
        titleId="own-preset-dialog-title"
        description={t('eq.own.dialogHint')}
        onClose={closeNewPresetDialog}
        closeLabel={t('support.close')}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={closeNewPresetDialog}
            >
              {t('dsp.eqImport.cancel')}
            </button>
            <button
              type="button"
              className="button small"
              disabled={trimmed === ''}
              onClick={create}
            >
              {t('eq.own.create')}
            </button>
          </div>
        }
      >
        <div className="own-preset-dialog__row">
          <label className="own-preset-dialog__label" htmlFor={nameId}>
            {t('eq.own.name')}
          </label>
          <input
            id={nameId}
            ref={inputRef}
            className="dsp-import__name"
            value={name}
            maxLength={USER_DSP_PRESET_NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                create();
              }
            }}
          />
        </div>
        <div className="own-preset-dialog__row">
          <span className="own-preset-dialog__label">
            {t('eq.own.curveFrom')}
            <small>{t('eq.own.curveFromHint')}</small>
          </span>
          <div
            className="segmented own-preset-dialog__choices"
            role="group"
            aria-label={t('eq.own.curveFrom')}
          >
            {CURVE_ORDER.filter((one) => starts.curves[one]).map((one) => (
              <button
                key={one}
                type="button"
                className={`segmented__option${
                  curveStart === one ? ' is-selected' : ''
                }`}
                aria-pressed={curveStart === one}
                onClick={() => setCurveStart(one)}
              >
                {curveLabel(one)}
              </button>
            ))}
          </div>
          <PresetCurveSpark curve={curve} size="wide" />
        </div>
        <div className="own-preset-dialog__row">
          <span className="own-preset-dialog__label">
            {t('eq.own.rackFrom')}
          </span>
          <div
            className="segmented own-preset-dialog__choices"
            role="group"
            aria-label={t('eq.own.rackFrom')}
          >
            {RACK_ORDER.filter((one) => starts.racks[one]).map((one) => (
              <button
                key={one}
                type="button"
                className={`segmented__option${
                  rackStart === one ? ' is-selected' : ''
                }`}
                aria-pressed={rackStart === one}
                onClick={() => setRackStart(one)}
              >
                {rackLabel(one)}
              </button>
            ))}
          </div>
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
};

export default NewPresetDialog;
