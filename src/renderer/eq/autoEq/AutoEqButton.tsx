/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties } from 'react';
import { endSmartEqStatus } from '../../utils/smartEqRun';
import MenuIcon from '../../icons/MenuIcon';
import Chevron from '../../icons/Chevron';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import AnimatedHeight from '../../widgets/AnimatedHeight';
import { PetArt } from '../../SupportPet';
import isOwnAnimationEnd from '../../utils/ownAnimationEnd';
import { endCorrectionFlash } from '../../utils/correctionFlash';
import { useTranslation } from '../../utils/I18nContext';
import {
  saveSongSoundNow,
  type ISongSoundNow,
  useSongSoundHeld,
  useSongSoundNow,
  useSongSoundParts,
} from '../../audio/songSoundSession';
import { useContinuousEq } from '../../utils/continuousEq';
import useHasChanged from '../../utils/useHasChanged';
import { useSmartEqPhase } from '../../utils/smartEqPreview';
import useAutoEqButton from './useAutoEqButton';
import AutoEqPanel from './AutoEqPanel';
import '../../styles/EqAutoPanel.scss';

/**
 * Auto EQ on the EQ page (Ivan, 2026-11-19: Smart EQ "now will be called Auto
 * EQ, with different modes"): the one place that decides each song's sound —
 * a song's saved sound, its album's, and Smart correction on top — behind the
 * row's one filled button, the action the page recommends. The button says
 * what decides the sound now; its panel (`AutoEqPanel`) holds the switches.
 *
 * The pet's bubble beside it is Smart correction's voice while it measures,
 * as it was Smart EQ's.
 */
type TSaveHalf = 'save' | 'saveChanges' | 'saved';

/**
 * What the button's Save half offers, the same press as the panel's (Ivan
 * approved, 2026-11-20): Save changes over a saved sound changed while it
 * plays, Saved for one that plays as saved, and "Save to this song" over the
 * listener's own sound — nothing while nothing plays, Song sounds is off or
 * Auto EQ steps aside.
 */
const saveHalfOf = (
  now: ISongSoundNow,
  isSongsOn: boolean,
  isHeld: boolean,
): TSaveHalf | undefined => {
  if (isHeld || !isSongsOn || !now.identity) {
    return undefined;
  }
  if (now.isChanged) {
    return 'saveChanges';
  }
  if (now.owner === 'song') {
    return 'saved';
  }
  return now.canSave ? 'save' : undefined;
};

/** The Save half itself: a segment sharing the button's edge, as the caret of
 * the row's other split controls does (`_mainContentToolbar.scss`). */
const AutoEqSaveHalf = ({
  save,
  title,
}: {
  save: TSaveHalf | undefined;
  title: string | undefined;
}) => {
  const { t } = useTranslation();
  // Save and Saved swap in when they swap, never as the page opens.
  const swap = useHasChanged(save ?? 'none') ? ' is-swap' : '';
  if (!save) {
    return null;
  }
  if (save === 'saved') {
    return (
      <span className={`eq-auto__save is-saved${swap}`} role="status">
        <MenuIcon name="check" className="eq-toolbar__icon" />
        <span className="eq-auto__save-word eq-toolbar__word">
          {t('autoEq.button.saved')}
        </span>
      </span>
    );
  }
  // The panel's own words for a screen reader; on the row one short word,
  // the main half already saying Changed or Yours. "Save changes" there
  // pushed the row into its narrower fit at full width, and the Preset and
  // Tone tabs gave up what they hold to make room.
  const name =
    save === 'saveChanges'
      ? t('autoEq.songs.saveChanges')
      : t('autoEq.songs.save');
  return (
    <button
      type="button"
      className={`eq-auto__save${swap}`}
      aria-label={name}
      title={title ? t('autoEq.button.saveFor', { title }) : name}
      onClick={saveSongSoundNow}
    >
      <MenuIcon name="save" className="eq-toolbar__icon" />
      <span className="eq-auto__save-word eq-toolbar__word" aria-hidden="true">
        {t('autoEq.button.save')}
      </span>
    </button>
  );
};

const AutoEqButton = () => {
  const { t } = useTranslation();
  const button = useAutoEqButton();
  const {
    isOpen,
    setIsOpen,
    holder,
    trigger,
    isBalancing,
    isContinuousRunning,
    balanceStatus,
    correctionFlash,
    bubbleText,
    bubbleRef,
    bubbleSpot,
  } = button;
  const parts = useSongSoundParts();
  const isHeld = useSongSoundHeld();
  const now = useSongSoundNow();
  const isSmartOn = useContinuousEq();
  const isAnyOn = parts.songs || parts.albums || isSmartOn;
  // A held song is measured no further (`smartEqHold.ts`): the button says
  // whose sound plays, as it does with Smart correction off.
  const isSmartHeld = useSmartEqPhase() === 'held';
  const isMeasuring = isBalancing || (isContinuousRunning && !isSmartHeld);

  // What decides the sound now, in a word after the name.
  let state = '';
  if (isMeasuring) {
    state = t('autoEq.state.measuring');
  } else if (now.isChanged) {
    state = t('autoEq.state.changed');
  } else if (now.owner === 'song') {
    state = t('autoEq.state.song');
  } else if (now.owner === 'album') {
    state = t('autoEq.state.album');
  } else if (isAnyOn) {
    state = t('autoEq.state.yours');
  }

  return (
    // The row's one filled button (Ivan, 2026-11-17, B1): the action the page
    // recommends, after the flat tools. Quiet while every part is off, so a
    // filled button never stands for something that is not happening.
    <span
      className={`eq-mode eq-auto${isOpen ? ' is-open' : ''}${
        isAnyOn ? '' : ' is-subtle'
      }`}
      ref={holder}
    >
      <button
        type="button"
        ref={trigger}
        aria-label={t('autoEq.aria')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        // Running gets the breathing outline and nothing else.
        className={`button small eq-mode__main${isAnyOn ? '' : ' subtle'}${
          isMeasuring ? ' is-running' : ''
        }`}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <MenuIcon name="smart" className="eq-toolbar__icon" />
        {/* Its name kept at every width, as Smart EQ's was: the row's
          narrowest fit hides the other tools' words, never this one's. */}
        {t('autoEq.title')}
        {state && <span className="eq-auto__state">{state}</span>}
        <Chevron />
      </button>
      <AutoEqSaveHalf
        save={saveHalfOf(now, parts.songs, isHeld)}
        title={now.identity?.title}
      />
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isOpen}
        className="eq-auto-panel"
        role="dialog"
        ariaLabel={t('autoEq.title')}
      >
        {/* Its height runs to each view's: Manage, a form, a row gone. */}
        <AnimatedHeight className="eq-auto-panel__body">
          <AutoEqPanel button={button} />
        </AnimatedHeight>
      </AnchoredMenu>
      {/* What Smart correction is doing, said by the pet, from the button
        itself: hung off the button it belongs to, it is obviously about that
        button, and the creature saying it is the same one that reacts to the
        music everywhere else in the app. */}
      {bubbleText && (
        <span
          // Green for a moment after a write reaches the engine, which is the
          // moment the sound changes.
          className={`eq-mode__bubble${
            correctionFlash ? ' is-applied' : ''
          }${bubbleSpot?.isBelow ? ' is-below' : ''}`}
          role="status"
          ref={bubbleRef}
          style={
            bubbleSpot
              ? ({
                  left: bubbleSpot.offsetLeft,
                  top: bubbleSpot.offsetTop,
                  right: 'auto',
                  bottom: 'auto',
                  '--bubble-tail': `${bubbleSpot.tailX}px`,
                  '--bubble-stem': `${bubbleSpot.stem}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <span className="eq-mode__bubble-pet" aria-hidden>
            <PetArt />
          </span>
          {/* Keyed on the landing, so a second correction arriving while the
            first is still green holds the colour for its own full moment. */}
          <span
            key={correctionFlash?.id ?? 'resting'}
            className="eq-mode__bubble-text"
            onAnimationEnd={(event) => {
              if (
                correctionFlash &&
                isOwnAnimationEnd(event, 'eq-bubble-applied')
              ) {
                endCorrectionFlash(correctionFlash.id);
              }
            }}
          >
            {balanceStatus ? (
              // Keyed on the remark, so each new one is held for its own full
              // moment; the hold's end is what ends it.
              <span
                key={balanceStatus.id}
                className="eq-mode__bubble-status"
                onAnimationEnd={(event) => {
                  if (isOwnAnimationEnd(event, 'smart-eq-status-hold')) {
                    endSmartEqStatus(balanceStatus.id);
                  }
                }}
              >
                {balanceStatus.text}
              </span>
            ) : (
              bubbleText
            )}
          </span>
        </span>
      )}
    </span>
  );
};

export default AutoEqButton;
