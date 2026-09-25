/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isEngineProblem, type TEngineProblem } from 'common/engineHealth';
import type { TranslationKey } from 'common/i18n/en';
import type { TEngineTrouble } from '../audio/engineTrouble';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import Button from '../widgets/Button';
// The output notice's look, which this shares: it is the same message — this
// output is not being processed — for a different reason.
import '../styles/DeviceProfiles.scss';
import '../styles/EngineTroubleNotice.scss';

const PROBLEM_TEXT: Record<TEngineProblem, TranslationKey> = {
  convolution: 'engineHealth.problem.convolution',
  'graphic-eq': 'engineHealth.problem.graphic-eq',
  'eq-phase': 'engineHealth.problem.eq-phase',
  'dsp-rack': 'engineHealth.problem.dsp-rack',
  'reload-failed': 'engineHealth.problem.reload-failed',
  unwatched: 'engineHealth.problem.unwatched',
};

/** One line per problem; codes this app does not know share a single line. */
const problemLines = (problems: readonly string[]): TranslationKey[] => [
  ...new Set(
    problems.map((code) =>
      isEngineProblem(code)
        ? PROBLEM_TEXT[code]
        : ('engineHealth.problem.other' as const),
    ),
  ),
];

interface IEngineTroubleNoticeProps {
  /**
   * What `useEngineTrouble` found, from the shell — which also turns the DSP
   * rack off while the engine is, so the two read the same answer.
   */
  trouble: TEngineTrouble | undefined;
  /** A dialog this notice's own buttons open is up: step aside for it. */
  isHidden: boolean;
  onRestartAudio: () => void;
  onUseApo: () => void;
  /**
   * Move the engine to another of the output's effect slots, for an engine
   * Windows is playing around (`bypassed`). One Windows permission prompt
   * and a moment of silence, and only ever from a press: the app does not
   * do this on its own.
   */
  onTryAnotherSlot: (guid: string) => void;
  /**
   * Put this app's own engine in place — the same step the help page's
   * troubleshooter offers. The one repair for a rack the engine could not
   * start, because a restart starts the same engine again.
   */
  onInstallEngine: () => void;
  /**
   * Bumped when the card is asked for again from outside — the side bar
   * switch pressed back on. A card put away for the session has to come
   * back on a press, or the press does nothing at all.
   */
  reopenCount?: number;
}

/**
 * Says so when the FluidEQ Engine is failing where it can be heard, and what
 * can be done about it — see `engineTrouble` for when that is.
 *
 * Everything else in FluidEQ goes on working either way; this only makes sure
 * a failing engine is not mistaken for an EQ that does nothing. Restarting
 * Windows audio restarts the engine, which is the repair for anything that
 * went wrong inside it; Equalizer APO is the way out when it is not.
 */
const EngineTroubleNotice = ({
  trouble,
  isHidden,
  onRestartAudio,
  onUseApo,
  onTryAnotherSlot,
  onInstallEngine,
  reopenCount = 0,
}: IEngineTroubleNoticeProps) => {
  const { t } = useTranslation();
  // Put away for the rest of the session, per trouble.
  //
  // It used to be put away only for as long as that trouble lasted, on the
  // reasoning that one which ends and returns is worth saying again. In
  // practice it does not end: the live capture that hears the sound starts
  // with the DSP page and stops with it, so leaving the page and coming back
  // ended the trouble and began an identical one, and the card came up on
  // every visit — with a user reporting exactly that, every time he returned
  // to the page with music playing. Nothing has changed between those two
  // moments, so there is nothing new to say.
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const key = trouble?.key;
  const putAway = (which: string) =>
    setDismissed((current) =>
      current.includes(which) ? current : [...current, which],
    );
  const wants = key !== undefined && !isHidden && !dismissed.includes(key);
  // Behind the output notice and the Room's 7.1 offer, which share the spot.
  const isShown = useNoticeTurn('engineTrouble', wants);

  // Asked for again from outside: whatever was put away this session comes
  // back. Not on the first render — the count starts where it starts — so a
  // card nobody asked for is not raised by the window opening.
  const asked = useRef(reopenCount);
  useEffect(() => {
    if (reopenCount !== asked.current) {
      asked.current = reopenCount;
      setDismissed([]);
    }
  }, [reopenCount]);

  // Only while it is on screen: an Escape meant for the notice in front of it
  // must not put this one away unseen.
  useEffect(() => {
    if (!isShown || key === undefined) {
      return undefined;
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      putAway(key);
    };
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [isShown, key]);

  if (!isShown || !trouble) {
    return null;
  }

  const isOff = trouble.kind === 'off';
  // An engine Windows has never once created is not an engine that stopped.
  // Offering "Restart Windows audio" there — the loud button, under a line
  // saying a restart usually brings it back — promised a user something that
  // could not happen, over and over.
  const neverRan = trouble.kind === 'off' && trouble.neverRan === true;
  // Windows is playing this output through a chain the engine is not in.
  // Restarting the audio rebuilds the same chains and changes nothing; the
  // engine has to be moved to another of the output's slots.
  const bypassed = trouble.kind === 'off' && trouble.bypassed === true;
  const canRestartHelp =
    trouble.kind === 'off' ? !neverRan && !bypassed : trouble.canRestartHelp;
  // The engine failing is Equalizer APO's cue; the engine's own DSP failing is
  // not, because APO has none of it — offering it there is an offer to give
  // up the EQ that is working for nothing in return.
  const canApoHelp = trouble.kind === 'off' || trouble.canApoHelp;
  // The rack is the one part of the engine a restart cannot mend: it runs
  // inside the engine, so the same engine comes back and fails the same way.
  // Putting this app's own engine in place is the repair, and a user who hit
  // this found it by himself on the help page after the card's restart did
  // nothing for him. So it leads here, and the restart goes quiet beside it.
  const newEngineHelps = trouble.kind === 'problems' && trouble.canInstallHelp;
  // And when the installed engine is known not to be the one this app
  // carries, the card says so rather than only offering the button.
  const engineIsOld = trouble.kind === 'problems' && trouble.updateReady;
  const dismiss = () => putAway(trouble.key);
  // Loud where it is the way out, quiet where it is the alternative: with an
  // engine Windows has never created, Equalizer APO is the only thing on this
  // card that processes any sound at all.
  const useApo = canApoHelp ? (
    <Button
      ariaLabel={t('engineHealth.useApo')}
      isDisabled={false}
      className={neverRan ? 'small' : 'small subtle'}
      handleChange={onUseApo}
    >
      {t('engineHealth.useApo')}
    </Button>
  ) : null;
  const notNow = (
    <Button
      ariaLabel={t('output.notNow')}
      isDisabled={false}
      className="small subtle"
      handleChange={dismiss}
    >
      {t('output.notNow')}
    </Button>
  );
  const restart = (
    <Button
      ariaLabel={t('app.menu.restartAudio')}
      isDisabled={false}
      className={newEngineHelps ? 'small subtle' : 'small'}
      handleChange={onRestartAudio}
    >
      {t('app.menu.restartAudio')}
    </Button>
  );
  let titleKey: TranslationKey = 'engineHealth.problemsTitle';
  if (isOff) {
    if (bypassed) {
      titleKey = 'engineHealth.bypassedTitle';
    } else if (neverRan) {
      titleKey = 'engineHealth.neverRanTitle';
    } else {
      titleKey = 'engineHealth.offTitle';
    }
  }

  return createPortal(
    <aside
      className={`device-apo-notice engine-trouble-notice${
        isOff ? '' : ' engine-trouble-notice--partial'
      }`}
      role="alertdialog"
      aria-labelledby="engine-trouble-notice-title"
      aria-describedby={
        newEngineHelps
          ? 'engine-trouble-notice-body engine-trouble-notice-repair'
          : 'engine-trouble-notice-body'
      }
    >
      <div className="device-apo-notice__copy">
        <span className="apo-badge">
          {isOff ? t('output.off') : t('engineHealth.partlyOff')}
        </span>
        <h2 id="engine-trouble-notice-title">
          {t(titleKey, { device: trouble.device.name })}
        </h2>
        {isOff ? (
          <p id="engine-trouble-notice-body">
            {bypassed && t('engineHealth.bypassedBody')}
            {!bypassed &&
              neverRan &&
              t('engineHealth.neverRanBody', { device: trouble.device.name })}
            {!bypassed && !neverRan && t('engineHealth.offBody')}
          </p>
        ) : (
          <ul
            id="engine-trouble-notice-body"
            className="engine-trouble-notice__problems"
          >
            {problemLines(trouble.problems).map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        )}
        {/* Sits under the list rather than in it: the list is what is off,
            this is what mends it. */}
        {newEngineHelps && (
          <p id="engine-trouble-notice-repair">
            {engineIsOld ? `${t('engineHealth.engineIsOld')} ` : ''}
            {t('engineHealth.rackNeedsEngine')}
          </p>
        )}
      </div>
      <div className="device-apo-notice__actions">
        {/* A fresh engine first, the restart demoted beside it: the restart
            is still worth a press for whatever else on the card a restart
            does mend, but it is no longer the answer being recommended. */}
        {newEngineHelps && (
          <>
            <Button
              ariaLabel={t('engineUpdate.action')}
              isDisabled={false}
              className="small"
              handleChange={onInstallEngine}
            >
              {t('engineUpdate.action')}
            </Button>
            {canRestartHelp && restart}
            {useApo}
            {notNow}
          </>
        )}
        {!newEngineHelps && canRestartHelp && (
          <>
            {restart}
            {useApo}
            {notNow}
          </>
        )}
        {!newEngineHelps && !canRestartHelp && (
          <>
            {/* Windows is playing this output through a chain the engine is
                not in. Moving it to another of the output's effect slots is
                the one thing that can put it in the way of the music, and it
                leads; a restart would rebuild the very same chains. */}
            {bypassed && (
              <>
                <Button
                  ariaLabel={t('engineHealth.tryAnotherSlot')}
                  isDisabled={false}
                  className="small"
                  handleChange={() => onTryAnotherSlot(trouble.device.guid)}
                >
                  {t('engineHealth.tryAnotherSlot')}
                </Button>
                {useApo}
                {notNow}
              </>
            )}
            {/* An engine Windows has never created: Equalizer APO is the way
                to have any processing at all, so it leads. Otherwise nothing
                here mends a file the engine could not read — the answer is a
                different file, chosen where it was chosen. */}
            {!bypassed && neverRan ? (
              <>
                {useApo}
                {notNow}
              </>
            ) : null}
            {!bypassed && !neverRan ? (
              <>
                <Button
                  ariaLabel={t('output.gotIt')}
                  isDisabled={false}
                  className="small"
                  handleChange={dismiss}
                >
                  {t('output.gotIt')}
                </Button>
                {useApo}
              </>
            ) : null}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
};

export default EngineTroubleNotice;
