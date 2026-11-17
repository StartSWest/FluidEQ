/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties } from 'react';
import {
  isContinuousMode,
  setSmartEqMode,
  SMART_EQ_MODES,
} from '../utils/smartEqMode';
import { setContinuousEq } from '../utils/continuousEq';
import {
  cancelSmartEq,
  endSmartEqStatus,
  runSmartEq,
} from '../utils/smartEqRun';
import MenuIcon from '../icons/MenuIcon';
import Chevron from '../icons/Chevron';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { PetArt } from '../SupportPet';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { endCorrectionFlash } from '../utils/correctionFlash';
import { type TEqPageBands } from './useEqPageBands';

/**
 * Smart EQ on the EQ page: the button, the menu of its modes, and the pet's
 * bubble that says what it is doing. One action at a time: choose a mode
 * while idle, Stop while measuring. Stopping keeps the correction already
 * applied. Moved out of the page's view as it stood, to the tools of the
 * Your EQ tab (`EqLayerTabs`).
 */
const EqSmartEqButton = ({ bands }: { bands: TEqPageBands }) => {
  const {
    t,
    isBalancing,
    balanceStatus,
    isContinuousOn,
    smartEqMode,
    isModeMenuOpen,
    setIsModeMenuOpen,
    modeMenuHolder,
    modeMenuTrigger,
    attachModeMenuEntry,
    closeModeMenu,
    isContinuousRunning,
    correctionFlash,
    bubbleText,
    bubbleRef,
    bubbleSpot,
    modeLabel,
    modeNote,
  } = bands;
  // An enabled continuous mode still needs a Stop while its layer is
  // bypassed, or restoring the layer could silently resume a forgotten run.
  const isSmartEqActive =
    isBalancing || (isContinuousMode(smartEqMode) && isContinuousOn);
  return (
    // The row's one filled button (Ivan, 2026-11-17, B1): the action the
    // page recommends, after the flat tools. It was quiet like the others
    // from 2026-09-27, when every tool in the row still had a box.
    <span
      className={`eq-mode${isModeMenuOpen ? ' is-open' : ''}`}
      ref={modeMenuHolder}
    >
      <button
        type="button"
        ref={modeMenuTrigger}
        aria-label={
          isSmartEqActive ? t('eq.smart.stopAria') : t('eq.smart.modeAria')
        }
        aria-expanded={isSmartEqActive ? undefined : isModeMenuOpen}
        aria-haspopup={isSmartEqActive ? undefined : 'menu'}
        // Never greyed out: the measurement opens its own tap on the
        // source and says in the bubble if it cannot. It used to wait
        // on the graph's loopback, which is not what it listens to.
        // Running gets the breathing outline and nothing else. It keeps
        // the Smart EQ button's own look, because it is that button.
        className={`button small eq-mode__main${isBalancing || isContinuousRunning ? ' is-running' : ''}`}
        // Nothing here runs the measurement — it asks the host that owns
        // it to. That indirection is what lets a run outlive this panel:
        // the button is a way of reaching the measurement, not the place
        // it lives.
        onKeyDown={(event) => {
          if (
            !isSmartEqActive &&
            (event.key === 'ArrowDown' || event.key === 'ArrowUp')
          ) {
            event.preventDefault();
            event.stopPropagation();
            setIsModeMenuOpen(true);
          }
        }}
        onClick={() => {
          if (!isSmartEqActive) {
            setIsModeMenuOpen((wasOpen) => !wasOpen);
            return;
          }
          setIsModeMenuOpen(false);
          setContinuousEq(false);
          if (isBalancing) {
            cancelSmartEq();
          }
        }}
      >
        <MenuIcon
          name={isSmartEqActive ? 'stop' : 'smart'}
          className="eq-toolbar__icon"
        />
        {isSmartEqActive ? modeLabel(smartEqMode) : t('eq.smart')}
        {!isSmartEqActive && <Chevron />}
      </button>
      {/* Include the remembered mode: selecting it is how a stopped
        run starts again. The menu is outside the panel that clips. */}
      <AnchoredMenu
        anchor={modeMenuHolder.current}
        isOpen={isModeMenuOpen && !isSmartEqActive}
        className="eq-mode__menu"
        ariaLabel={t('eq.smart.modeAria')}
      >
        {SMART_EQ_MODES.map((entry) => (
          <button
            key={entry}
            type="button"
            role="menuitemradio"
            aria-checked={entry === smartEqMode}
            ref={entry === smartEqMode ? attachModeMenuEntry : undefined}
            // The menu opens only while nothing runs
            // (\`isSmartEqActive\`), so nothing here is running yet.
            onClick={() => {
              closeModeMenu();
              if (entry === smartEqMode) {
                if (isContinuousMode(entry)) {
                  setContinuousEq(true);
                } else {
                  runSmartEq();
                }
                return;
              }
              // A different mode starts through the engine's own
              // mode transition; asking it to run again would toggle
              // the freshly started one-shot back off.
              setSmartEqMode(entry);
            }}
          >
            <MenuIcon name="smart" className="eq-toolbar__icon" />
            <span className="eq-mode__menu-name">{modeLabel(entry)}</span>
            {/* Each says what it overrides, because the names alone
              cannot: three of them do the same job to three different
              depths, and which depth is the whole choice being made
              here. */}
            <span className="eq-mode__menu-note">{modeNote(entry)}</span>
          </button>
        ))}
      </AnchoredMenu>
      {/* What it is doing, said by the pet, from the button itself.
        It was a bare run of text sitting in the row, which put a
        sentence that changes among a line of controls that do not and
        made the toolbar reflow every time the wording changed. Hung off
        the button it belongs to, it is obviously about that button —
        and the creature saying it is the same one that reacts to the
        music everywhere else in the app, so the app has one voice
        rather than a label here and a character there. */}
      {bubbleText && (
        <span
          // Green for a moment after a write reaches Equalizer APO, which
          // is the moment the sound changes. It is the one thing in here
          // that is not a sentence about what will happen: it means it
          // just did.
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
          {/* Keyed on the landing, so a second correction arriving
              while the first is still green holds the colour for its
              own full moment rather than for what the first had left.
              The text's hold (`eq-bubble-applied`) is that moment, and
              its end is what ends the flash. */}
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
              // Keyed on the remark, so each new one is held for its
              // own full moment; the hold's end is what ends it.
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

export default EqSmartEqButton;
