/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ErrorDescription } from 'common/errors';
import type { TranslationKey } from '../../common/i18n/en';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import { InfoMark } from '../dsp/GenreNotesParts';
import { genreNotesFor } from '../dsp/genreNotesModel';
import { openGenreNotes } from '../dsp/genreNotesStore';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon, { MenuIconName } from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import { LAYER_SWATCH } from '../styles/color';
import type { TActiveLayers } from './useActiveLayers';

/**
 * The applied layers as chips: each one's A/B switch, its strength and its
 * remove button. Laid out as a row by `ActiveLayers` on the EQ page, and as
 * a column wherever they sit in a menu — its own, when the row has folded,
 * and the mini player's.
 */
const ActiveLayerChips = ({ active }: { active: TActiveLayers }) => {
  const { layers, isBypassed, voicingGlyph, toggle, setStrength } = active;
  const { t } = useTranslation();
  const { isBlockingError, isEnabled, setGlobalError, voicing } =
    useFluidEqContext();
  // The Preset layer of a genre's chain opens that genre's notes. Only a
  // `dsp:` voicing: an older voicing can share a genre's name and not its
  // curve, and the notes would describe a line the graph is not drawing.
  const presetId = dspVoicingPresetId(voicing);
  const genre = presetId ? genreNotesFor(presetId) : undefined;
  return (
    <>
      {layers.map((layer) => (
        <span
          className={`active-layer${
            (layer.feature && isBypassed(layer.feature)) || layer.isInactive
              ? ' is-bypassed'
              : ''
          }${layer.strength !== undefined ? ' has-strength' : ''}${
            layer.isVoicing && genre ? ' has-notes' : ''
          }`}
          key={layer.key}
        >
          {/* The body of the chip is the A/B switch.

                Pressing it takes the layer out of the config and leaves it here,
                dimmed; pressing again puts it back. Nothing is recomputed either
                way, which is the point — a correction is either an improvement or
                it is not, and the only way to tell is to hear the same passage
                both ways within a few seconds of itself. Removing and re-applying
                is not that: Smart EQ takes half a minute to measure and a cleared
                voicing is one you have to go and find.

                One call each way, and the same call: a layer is switched off by
                its file not being included, so there is no state in between for a
                half-finished press to land in.

                A plain span for the convolution, which is a line in the device
                file rather than an include and so has nothing to leave out. */}
          {layer.feature ? (
            <button
              type="button"
              className="active-layer__body"
              aria-pressed={!isBypassed(layer.feature)}
              disabled={isBlockingError || !isEnabled}
              title={
                isBypassed(layer.feature)
                  ? t('eq.layers.enable', { layer: layer.label })
                  : t('eq.layers.disable', { layer: layer.label })
              }
              onClick={() => toggle(layer)}
            >
              <span
                className="active-layer__swatch"
                style={{ background: LAYER_SWATCH[layer.key] }}
                aria-hidden
              />
              {layer.isVoicing ? (
                <VoicingIcon
                  profileId={voicingGlyph}
                  className="active-layer__icon"
                />
              ) : (
                <MenuIcon
                  name={layer.icon as MenuIconName}
                  className="active-layer__icon"
                />
              )}
              <span className="active-layer__label">{layer.label}</span>
              <span className="active-layer__name" title={layer.name}>
                {layer.name}
                {/* Its own cell with a reserved width, so 5% and 100% take the
                      same room. Appended to the name it changed the chip width on
                      every step of a drag, shoving the chips beside it around
                      under the cursor. */}
                {layer.percent !== undefined && (
                  <em className="active-layer__percent">{layer.percent}%</em>
                )}
                {/* A pip, not a word. The row is four chips wide already and
                      this is a state of one of them rather than a fifth thing to
                      read; the title carries the sentence. */}
                {layer.isLive && (
                  <span
                    className="active-layer__live"
                    title={t('eq.smart.continuousAria')}
                  />
                )}
              </span>
            </button>
          ) : (
            <span className="active-layer__body">
              <span
                className="active-layer__swatch"
                style={{ background: LAYER_SWATCH[layer.key] }}
                aria-hidden
              />
              {layer.isVoicing ? (
                <VoicingIcon
                  profileId={voicingGlyph}
                  className="active-layer__icon"
                />
              ) : (
                <MenuIcon
                  name={layer.icon as MenuIconName}
                  className="active-layer__icon"
                />
              )}
              <span className="active-layer__label">{layer.label}</span>
              <span className="active-layer__name" title={layer.name}>
                {layer.name}
                {/* Its own cell with a reserved width, so 5% and 100% take the
                      same room. Appended to the name it changed the chip width on
                      every step of a drag, shoving the chips beside it around
                      under the cursor. */}
                {layer.percent !== undefined && (
                  <em className="active-layer__percent">{layer.percent}%</em>
                )}
                {/* A pip, not a word. The row is four chips wide already and
                      this is a state of one of them rather than a fifth thing to
                      read; the title carries the sentence. */}
                {layer.isLive && (
                  <span
                    className="active-layer__live"
                    title={t('eq.smart.continuousAria')}
                  />
                )}
              </span>
            </span>
          )}
          {/* Outside the body, not inside it: the body is a button, and a range
                input nested in one cannot be dragged — the button swallows the
                pointer and every attempt to slide toggles the layer off instead.

                ALWAYS DRAGGABLE, INCLUDING WHILE BYPASSED, and that is a fix
                rather than a relaxation. It used to be disabled when the layer was
                switched off, which reads as sensible and is a dead end: the only
                way back to a strength is the slider, so switching a layer off
                locked its strength wherever it happened to be. Two of today's
                reports were the same shape — a control that removes itself at the
                end of its own travel — and this is the third instance of it.

                It stays greyed to the eye through `.is-bypassed` on the chip, so
                it still says "this has a strength and none of it is being
                applied" without also refusing to be moved. It is never removed
                either: taking it away changed the chip's width, so switching a
                layer off resized it and shoved every chip beside it along. */}
          {layer.strength !== undefined && (
            <input
              type="range"
              className="active-layer__strength"
              min={0}
              max={100}
              step={5}
              value={Math.round(layer.strength * 100)}
              aria-label={t('voicing.strength')}
              title={t('voicing.strength')}
              disabled={isBlockingError || !isEnabled}
              style={
                {
                  '--fill': `${Math.round(layer.strength * 100)}%`,
                } as React.CSSProperties
              }
              onChange={(event) =>
                setStrength(layer, Number(event.target.value) / 100)
              }
            />
          )}
          {/* Before the remove button, so the one that takes the layer away
                stays the last thing on every chip. */}
          {layer.isVoicing && genre && presetId && (
            <button
              type="button"
              className="active-layer__info"
              aria-label={t('genre.notes.about', {
                name: t(genre.labelKey as TranslationKey),
              })}
              title={t('genre.notes.about', {
                name: t(genre.labelKey as TranslationKey),
              })}
              onClick={() => openGenreNotes(presetId)}
            >
              <InfoMark />
            </button>
          )}
          <button
            type="button"
            aria-label={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            title={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            disabled={isBlockingError || !isEnabled}
            onClick={() => {
              // Switching it back on is the main process's job, not this
              // button's. Every clear here goes through a handler that already
              // treats a layer being taken away as reason enough — and doing it
              // from this side would have switched the EQ back on even where
              // its X does nothing at all, which is the case for bands nobody
              // applied a reference to.
              layer
                .onClear()
                .catch((e) => setGlobalError(e as ErrorDescription));
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </span>
      ))}
    </>
  );
};

export default ActiveLayerChips;
