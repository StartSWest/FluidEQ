/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { IAudioRestart } from '../utils/useAudioRestart';
import { useTranslation } from '../utils/I18nContext';
import Button from '../widgets/Button';
// The output notice's spot and card, which this shares.
import '../styles/DeviceProfiles.scss';
import '../styles/EngineUpdateNotice.scss';

/**
 * The stylesheet's own rule, asked of the document: another notice holds the
 * spot, and this one is out of sight behind it (EngineUpdateNotice.scss).
 */
const OTHER_NOTICE = '.device-apo-notice:not(.engine-update-notice)';

interface IEngineUpdateNoticeProps {
  /**
   * The update itself, owned by the shell (`useEngineUpdate`) so it outlives
   * this card: closed while it runs, it carries on, and a failure brings the
   * card back by itself with the reason on it.
   */
  update: IAudioRestart;
  /** Something that takes the window is up: this can wait until it goes. */
  isHidden: boolean;
}

/**
 * Offers this app's FluidEQ Engine in place of the one installed, which an app
 * update never replaces (`src/main/engineUpdate.ts`), and says how it went.
 *
 * The accent and not red: the engine already on the machine is processing the
 * audio, so this is an offer, not a fault — and it waits behind every other
 * notice in the same spot, which are about sound the EQ is not reaching.
 *
 * The restart card's four states in the notice's shape: the offer; the update
 * running, the button breathing and the foot saying so from the first second,
 * because the Windows prompt can take a moment to appear; done; and failed,
 * a declined prompt told apart from a run that failed, with the helper's own
 * reason under the line.
 */
const EngineUpdateNotice = ({ update, isHidden }: IEngineUpdateNoticeProps) => {
  const { t } = useTranslation();
  const { isOpen, phase, outcome, run, close } = update;
  const isShown = isOpen && !isHidden;

  useEffect(() => {
    if (!isShown) {
      return undefined;
    }
    // Put away, as the other notices here are. Mid-update that only hides
    // the card; the update is not the card's to stop.
    //
    // Only when it is what the Escape was for. On the window, so it hears the
    // key after every dialog's own listener on the document, and a dialog
    // that has answered it (they all preventDefault) closes alone; and not
    // while another notice has this one out of sight, where an Escape meant
    // for that one would put this away unseen until the next launch.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.querySelector(OTHER_NOTICE) !== null
      ) {
        return;
      }
      close();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [close, isShown]);

  if (!isShown) {
    return null;
  }

  const isRunning = phase === 'running';
  const isDone = phase === 'done';
  const primaryLabel =
    phase === 'failed' ? t('restart.tryAgain') : t('engineUpdate.action');
  const quietLabel = isRunning ? t('restart.close') : t('output.notNow');

  return createPortal(
    <aside
      className={`device-apo-notice engine-update-notice${
        isDone ? ' engine-update-notice--done' : ''
      }`}
      role="dialog"
      aria-labelledby="engine-update-notice-title"
      aria-describedby="engine-update-notice-body"
      aria-busy={isRunning}
    >
      <div className="device-apo-notice__copy">
        <span className="apo-badge">
          {isDone ? t('engineUpdate.doneBadge') : t('engineUpdate.badge')}
        </span>
        <h2 id="engine-update-notice-title">
          {isDone ? t('engineUpdate.doneTitle') : t('engineUpdate.title')}
        </h2>
        <p id="engine-update-notice-body">
          {isDone ? t('engineUpdate.doneBody') : t('engineUpdate.body')}
        </p>
        {phase === 'failed' && (
          <p className="device-apo-notice__error">
            {outcome?.declined
              ? t('engineUpdate.declined')
              : t('engineUpdate.failed')}
            {outcome?.detail && (
              <span className="engine-update-notice__reason">
                {outcome.detail}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="engine-update-notice__foot">
        <p className="engine-update-notice__status" aria-live="polite">
          {isRunning ? t('engineUpdate.running') : ''}
        </p>
        <div className="device-apo-notice__actions">
          {isDone ? (
            <Button
              ariaLabel={t('output.gotIt')}
              isDisabled={false}
              className="small"
              handleChange={close}
            >
              {t('output.gotIt')}
            </Button>
          ) : (
            <>
              <Button
                ariaLabel={primaryLabel}
                isDisabled={isRunning}
                className={`small${isRunning ? ' is-running' : ''}`}
                handleChange={run}
              >
                {primaryLabel}
              </Button>
              <Button
                ariaLabel={quietLabel}
                isDisabled={false}
                className="small subtle"
                handleChange={close}
              >
                {quietLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>,
    document.body,
  );
};

export default EngineUpdateNotice;
