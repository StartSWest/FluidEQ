/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import { MAX_GAIN, MIN_GAIN, PREAMP_MIN_GAIN } from 'common/constants';
import { TONE_MAX_DB } from 'common/tone';
import EqModeTriggerFace from '../eqMode/EqModeTriggerFace';
import { TONE_CONTROLS } from '../../eq/useTone';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import LibraryCoverArt from '../../library/LibraryCoverArt';
import { formatDuration } from '../../library/player/NowPlayingBar';
import { bandLabel } from '../../player/MiniBands';
import PlayerFader from '../../player/PlayerFader';
import PlayerIcon, { type TPlayerIconName } from '../../player/PlayerIcon';
import { formatQueueTime } from '../../player/playerText';
import useFaderRow from '../../player/useFaderRow';
import { getBandColor } from '../../utils/bandColors';
import { useTranslation } from '../../utils/I18nContext';
import { useRainbowStops } from '../../utils/rainbowPalette';
import ToneKnob from '../../widgets/ToneKnob';
import {
  PICTURE_BANDS,
  PICTURE_NOW,
  PICTURE_OUTPUT,
  PICTURE_PLAYLIST_COUNT,
  PICTURE_PREAMP_DB,
  PICTURE_QUEUE,
  PICTURE_QUEUE_COUNT,
  PICTURE_QUEUE_LEFT_MS,
  PICTURE_TONE,
} from './playerPictureData';

/**
 * The lower half of the Compact player's picture in What's New
 * (`PlayerPicture`): Sound, Up next and the foot, as the player draws them,
 * playing the made-up queue and levels of `playerPictureData.ts`.
 */

const nothing = () => undefined;
const nothingAsync = async () => undefined;

/** Every band's fader, in the band colours the player paints them in. */
const PictureBands = () => {
  const { t } = useTranslation();
  const rainbow = useRainbowStops();
  // The player's own sharing-out of the row (`useFaderRow`), at this zoom.
  const fadersRef = useRef<HTMLDivElement>(null);
  useFaderRow(fadersRef, PICTURE_BANDS.length, nothing);
  return (
    <>
      <div className="player-bands">
        <PlayerFader
          ariaLabel={t('sidebar.preamp')}
          label={
            <button
              type="button"
              className="player-band__auto is-on"
              aria-pressed
            >
              {t('player.eq.auto')}
            </button>
          }
          value={PICTURE_PREAMP_DB}
          min={PREAMP_MIN_GAIN}
          max={MAX_GAIN}
          step={0.1}
          zero={0}
          colour="var(--player-lamp)"
          isDisabled
          onHold={nothing}
          onChange={nothing}
        />
        <span className="player-bands__rule" />
        <div className="player-bands__window">
          <div className="player-bands__faders" ref={fadersRef}>
            {PICTURE_BANDS.map((band, i) => (
              <PlayerFader
                key={band.hz}
                ariaLabel={`${bandLabel(band.hz)} Hz`}
                label={bandLabel(band.hz)}
                value={band.gain}
                min={MIN_GAIN}
                max={MAX_GAIN}
                step={0.1}
                zero={0}
                colour={`var(--player-band-tint, ${
                  getBandColor(i / (PICTURE_BANDS.length - 1), rainbow).color
                })`}
                isDisabled={false}
                onHold={nothing}
                onChange={nothing}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="player-eq__foot player-sound__foot">
        <span className="eq-mode is-subtle quick-layouts">
          <button
            type="button"
            className="button small subtle eq-mode__main quick-layouts__trigger"
            aria-label={t('eq.quickLayouts')}
          >
            <MenuIcon name="layout" className="eq-toolbar__icon" />
            <span className="band-designs__current">
              {t('eq.bandCount', { count: PICTURE_BANDS.length })}
            </span>
            <Chevron />
          </button>
        </span>
        <div className="eq-toolbar__option">
          <button
            type="button"
            className="eq-mode-trigger"
            aria-label={t('eq.mode')}
          >
            <EqModeTriggerFace customized={false} end={<Chevron />} />
          </button>
        </div>
        <button type="button" className="button small subtle clear-eq-trigger">
          <MenuIcon name="reset" className="eq-toolbar__icon" />
          <span className="eq-toolbar__word">{t('eq.clear')}</span>
        </button>
      </div>
    </>
  );
};

/** The preamp under Auto normalize, then Bass, Mid and Treble. */
const PictureTone = () => {
  const { t } = useTranslation();
  return (
    <div className="player-tone">
      <ToneKnob
        name={t('sidebar.preamp')}
        label={
          <button
            type="button"
            className="player-tone__auto is-on"
            aria-pressed
          >
            {t('sidebar.preamp')}
            <span className="player-tone__auto-tag">{t('player.eq.auto')}</span>
          </button>
        }
        value={PICTURE_PREAMP_DB}
        min={PREAMP_MIN_GAIN}
        max={MAX_GAIN}
        centre={0}
        isDisabled
        step={0.1}
        unit={t('sidebar.autoLabel')}
        defaultValue={0}
        handleChange={nothingAsync}
      />
      {TONE_CONTROLS.map(({ knob, labelKey }) => (
        <ToneKnob
          key={knob}
          name={t(labelKey)}
          value={PICTURE_TONE[knob]}
          min={-TONE_MAX_DB}
          max={TONE_MAX_DB}
          isDisabled={false}
          step={0.1}
          unit="dB"
          defaultValue={0}
          handleChange={nothingAsync}
        />
      ))}
    </div>
  );
};

/** Sound, open on its Tone or its EQ's bands. */
export const PlayerPictureSound = ({ face }: { face: 'tone' | 'bands' }) => {
  const { t } = useTranslation();
  return (
    <section className="player-eq player-sound">
      <div className="player-eq__keys player-sound__head">
        <button type="button" className="player-sound__fold" aria-expanded>
          <PlayerIcon name="sound" className="player-icon player-sound__mark" />
          <span className="player-sound__name">{t('player.sound.title')}</span>
          <PlayerIcon
            name="fold"
            className="player-icon player-sound__chevron"
          />
        </button>
        <div className="rich-pick voicing-pick">
          <button
            type="button"
            className="rich-pick__trigger"
            aria-label={t('dsp.presets')}
          >
            <VoicingIcon className="rich-pick__glyph" />
            <span className="rich-pick__label">{t('dsp.eqPreset.custom')}</span>
            <Chevron className="rich-pick__caret" />
          </button>
        </div>
        <span className="player-split">
          <button
            type="button"
            className="button small subtle player-led player-split__main"
            aria-pressed={false}
          >
            <span className="player-led__lamp" />
            {t('player.eq.smart')}
          </button>
          <button
            type="button"
            className="button small subtle player-led player-split__caret"
            aria-label={t('eq.smart.modeAria')}
          >
            <PlayerIcon
              name="caret"
              className="player-icon player-icon--caret"
            />
          </button>
        </span>
        <button
          type="button"
          className="player-sound__power"
          aria-pressed
          aria-label={t('sidebar.systemEq')}
        >
          <PlayerIcon name="power" />
        </button>
      </div>
      <div className="player-sound__drawer">
        <div className="player-sound__body">
          <div className="player-sound__tabs">
            <span className="player-eq__faces" role="group">
              <button
                type="button"
                className="player-eq__face"
                aria-pressed={face === 'tone'}
              >
                {t('eq.tone')}
              </button>
              <button
                type="button"
                className="player-eq__face"
                aria-pressed={face === 'bands'}
              >
                {t('player.sound.bands', { count: PICTURE_BANDS.length })}
              </button>
            </span>
            <span className="player-sound__state">
              <span className="player-sound__lamp" />
              {t('player.sound.on')}
            </span>
          </div>
          {face === 'tone' ? <PictureTone /> : <PictureBands />}
        </div>
      </div>
    </section>
  );
};

const shelfTab = (
  icon: TPlayerIconName,
  label: string,
  count: number,
  isSelected: boolean,
) => (
  <button
    type="button"
    role="tab"
    className="player-shelf__tab"
    aria-selected={isSelected}
  >
    <PlayerIcon name={icon} />
    <span className="player-shelf__label">{label}</span>
    <span className="player-shelf__count">{count}</span>
  </button>
);

/** Up next and Playlists, open on Up next at the song playing. */
export const PlayerPictureShelf = () => {
  const { t } = useTranslation();
  return (
    <section className="player-shelf">
      <div className="player-shelf__tabs" role="tablist">
        {shelfTab('upNext', t('library.upNext'), PICTURE_QUEUE_COUNT, true)}
        {shelfTab(
          'playlists',
          t('library.browse.playlist'),
          PICTURE_PLAYLIST_COUNT,
          false,
        )}
        <span className="player-shelf__end">
          <span className="player-shelf__time">
            {formatQueueTime(PICTURE_QUEUE_LEFT_MS)}
          </span>
          <button
            type="button"
            className="player-shelf__key"
            aria-label={t('player.queue.save')}
          >
            <PlayerIcon name="save" />
          </button>
          <button
            type="button"
            className="player-shelf__key player-shelf__fold"
            aria-expanded
            aria-label={t('player.queue.fold')}
          >
            <PlayerIcon
              name="fold"
              className="player-icon player-shelf__chevron"
            />
          </button>
        </span>
      </div>
      <div className="player-shelf__page" role="tabpanel">
        <section className="player-queue">
          <ol className="player-queue__list">
            {PICTURE_QUEUE.map((song, at) => {
              const isAhead = at > PICTURE_NOW;
              return (
                <li
                  key={song.title}
                  className={isAhead ? 'is-ahead' : undefined}
                >
                  <button
                    type="button"
                    className={`player-queue__row${
                      at === PICTURE_NOW ? ' is-now' : ''
                    }${at < PICTURE_NOW ? ' is-played' : ''}`}
                  >
                    <PlayerIcon
                      name="grip"
                      className="player-icon player-queue__grip"
                    />
                    <span className="player-queue__art">
                      <LibraryCoverArt
                        src={song.cover}
                        label={song.title}
                        size="row"
                      />
                    </span>
                    <span className="player-queue__song">
                      <span className="player-queue__title">{song.title}</span>
                      <span className="player-queue__artist">
                        {song.artist}
                      </span>
                    </span>
                    <span className="player-queue__time">
                      {formatDuration(song.durationMs)}
                    </span>
                  </button>
                  {isAhead && (
                    <button
                      type="button"
                      className="player-queue__remove"
                      aria-label={t('library.queue.remove')}
                    >
                      <PlayerIcon name="remove" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </section>
  );
};

/** The output it plays on and the engine that plays it, switched on. */
export const PlayerPictureFoot = () => {
  const { t } = useTranslation();
  return (
    <footer className="player-foot">
      <span className="player-foot__output">
        <PlayerIcon name="headphones" />
        <span className="player-foot__words">{t(PICTURE_OUTPUT)}</span>
      </span>
      <span className="player-foot__engine is-on">
        <span className="player-foot__lamp" />
        <span className="player-foot__words">
          {t('player.foot.on', { engine: t('engine.fluid.name') })}
        </span>
      </span>
    </footer>
  );
};
