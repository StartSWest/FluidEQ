/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties, useState } from 'react';
import { endSmartEqStatus } from '../../utils/smartEqRun';
import MenuIcon from '../../icons/MenuIcon';
import Chevron from '../../icons/Chevron';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import AnimatedHeight from '../../widgets/AnimatedHeight';
import PetCanvas from '../../pet/PetCanvas';
import isOwnAnimationEnd from '../../utils/ownAnimationEnd';
import { endCorrectionFlash } from '../../utils/correctionFlash';
import { useTranslation } from '../../utils/I18nContext';
import {
  useSongSoundHeld,
  useSongSoundNow,
  useSongSoundParts,
  useSongSoundSaveTick,
} from '../../audio/songSoundSession';
import { useContinuousEq } from '../../utils/continuousEq';
import { useSmartEqPhase } from '../../utils/smartEqPreview';
import useAutoEqButton from './useAutoEqButton';
import AutoEqPanel from './AutoEqPanel';
import AutoEqSaveHalf, { saveHalfOf } from './AutoEqSaveHalf';
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
  // The last save whose Saved has been shown; one pressed since is shown now.
  // Taken at mount, so opening the page never shows an old save.
  const saveTick = useSongSoundSaveTick();
  const [shownTick, setShownTick] = useState(saveTick);
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
        save={saveHalfOf(now, parts.songs, isHeld, saveTick !== shownTick)}
        title={now.identity?.title}
        moment={saveTick}
        onSavedShown={() => setShownTick(saveTick)}
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
            <PetCanvas art={22} isCelebrating={false} />
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
