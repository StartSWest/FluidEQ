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

import { ReactNode, useEffect, useState } from 'react';
import type { TAudioEngine } from 'common/audioEngine';
import { useTranslation } from '../utils/I18nContext';
import renderInline from '../utils/inlineMarkup';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from './DialogFrame';
import '../styles/AudioTroubleshooter.scss';

/**
 * What to do when the audio has gone wrong, in the order worth trying.
 *
 * Every one of these repairs already existed in the actions menu, sitting in a
 * flat list with no indication that three of them are the same fix escalating —
 * or that the cheap one solves most cases and the expensive one costs a reboot.
 * Somebody whose sound has stopped does not want a menu of tools; they want to
 * be told what to press first.
 *
 * Ordered by cost, not by likelihood, and the two happen to agree here. Restart
 * the audio service (seconds, nothing lost) before reattaching devices (a
 * dialog) before reinstalling the engine (a reboot). Stopping at the first one
 * that works is the whole point of an order.
 *
 * It does not diagnose. Windows does not report *why* an endpoint was
 * invalidated in any form worth acting on, and a guess dressed as a diagnosis
 * sends people down the wrong branch with more confidence than they started
 * with. So this says what each step fixes and lets somebody pick, which is also
 * what makes it usable over a support thread.
 */

interface IAudioTroubleshooterProps {
  /**
   * Which engine is carrying the audio.
   *
   * Three of the steps below are Equalizer APO's own repairs — its Device
   * Selector, its two installation modes, its installer. Under the FluidEQ
   * Engine none of them exist, and offering them would send somebody into a
   * program they do not have to fix a fault it is not causing.
   */
  engine: TAudioEngine | null;
  onClose: () => void;
  onRestartAudio: () => void;
  onReconfigure: () => void;
  onReinstallApo: () => void;
  /** Re-registers the FluidEQ Engine and re-attaches every output. */
  onEnableEngine: () => void;
  /**
   * Takes the engine off the output Windows is currently playing through,
   * restoring whatever effect chain it replaced.
   *
   * The only way out of the engine that does not mean switching engines: a
   * user handing one output back to another audio tool, or proving to
   * themselves that a fault is or is not ours, had no control anywhere in the
   * app that did it.
   */
  onRemoveEngineFromOutput: () => void;
}

interface IStep {
  title: string;
  /** The symptom this one actually addresses. */
  when: string;
  cost: string;
  action?: { label: string; run: () => void };
  detail?: ReactNode;
}

export default function AudioTroubleshooter({
  engine,
  onClose,
  onRestartAudio,
  onReconfigure,
  onReinstallApo,
  onEnableEngine,
  onRemoveEngineFromOutput,
}: IAudioTroubleshooterProps) {
  const { t } = useTranslation();
  // Which steps have been tried, so somebody working down the list can see
  // where they are. Not persisted and not authoritative — it is a reminder,
  // not a record, and any of them can be run again.
  const [tried, setTried] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A card opened from one of these steps — "Restart Windows audio" —
      // handles its own Escape and marks it handled. Closing here as well
      // shut both with one press and lost the record of what had been tried.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isApo = engine === 'apo';
  const isFluid = engine === 'fluid';

  /**
   * Everything below the first step depends on which engine is running: three
   * of the four are Equalizer APO's own repairs, and the machine running the
   * FluidEQ Engine may not have Equalizer APO on it at all.
   */
  const apoSteps: IStep[] = [
    {
      title: t('troubleshoot.apo.reselect.title'),
      when: t('troubleshoot.apo.reselect.when'),
      cost: t('troubleshoot.apo.reselect.cost'),
      action: {
        label: t('troubleshoot.apo.openSelector'),
        run: onReconfigure,
      },
    },
    {
      title: t('troubleshoot.apo.mode.title'),
      when: t('troubleshoot.apo.mode.when'),
      cost: t('troubleshoot.apo.mode.cost'),
      action: {
        label: t('troubleshoot.apo.openSelector'),
        run: onReconfigure,
      },
      detail: <p>{renderInline(t('troubleshoot.apo.mode.detail'), 'mode')}</p>,
    },
    {
      title: t('troubleshoot.apo.reinstall.title'),
      when: t('troubleshoot.apo.reinstall.when'),
      cost: t('troubleshoot.apo.reinstall.cost'),
      action: {
        label: t('troubleshoot.apo.reinstall.title'),
        run: onReinstallApo,
      },
    },
    {
      title: t('troubleshoot.apo.readd.title'),
      when: t('troubleshoot.apo.readd.when'),
      cost: t('troubleshoot.apo.readd.cost'),
      detail: <p>{t('troubleshoot.apo.readd.detail')}</p>,
    },
  ];

  const engineSteps: IStep[] = [
    {
      title: t('troubleshoot.engine.enable.title'),
      when: t('troubleshoot.engine.enable.when'),
      cost: t('troubleshoot.engine.permission'),
      action: { label: t('output.enable'), run: onEnableEngine },
    },
    {
      title: t('troubleshoot.engine.remove.title'),
      when: t('troubleshoot.engine.remove.when'),
      cost: t('troubleshoot.engine.remove.cost'),
      action: {
        label: t('troubleshoot.engine.remove.action'),
        run: onRemoveEngineFromOutput,
      },
    },
  ];

  // Neither engine's own repairs while the status is not known yet: showing
  // Equalizer APO's Device Selector on a machine actually running the FluidEQ
  // Engine (or the other way round) sends someone to fix a program that is
  // not carrying their audio at all. The restart step is engine-neutral, so
  // it stays.
  let engineOwnSteps: IStep[] = [];
  if (isApo) {
    engineOwnSteps = apoSteps;
  } else if (isFluid) {
    engineOwnSteps = engineSteps;
  }

  const steps: IStep[] = [
    {
      title: t('troubleshoot.restart.title'),
      when: t('troubleshoot.restart.when'),
      cost: t('troubleshoot.restart.cost'),
      action: { label: t('restart.action'), run: onRestartAudio },
    },
    ...engineOwnSteps,
  ];

  return (
    <div
      className="troubleshoot-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogFrame
        className="troubleshoot"
        icon={<MenuIcon name="wrench" />}
        title={t('troubleshoot.title')}
        titleId="troubleshoot-title"
        description={t('troubleshoot.description')}
        closeLabel={t('restart.close')}
        onClose={onClose}
        footer={
          <p className="dialog-frame__note">
            {renderInline(
              t('troubleshoot.footer', { report: t('app.menu.reportProblem') }),
              'footer',
            )}
          </p>
        }
      >
        {/* Numbered, and the numbers matter — this is a sequence, not a set of
            options. Only the first step's button is the loud one: it is the
            one this panel recommends, and the rest are there to be reached in
            order — the last of them takes the engine away rather than
            repairing anything. */}
        <ol className="troubleshoot__steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`troubleshoot__step${tried[index] ? ' is-tried' : ''}`}
            >
              <span className="troubleshoot__number" aria-hidden="true">
                {index + 1}
              </span>
              <div className="troubleshoot__step-main">
                <div className="troubleshoot__step-head">
                  <h3>{step.title}</h3>
                  {tried[index] && (
                    <span className="troubleshoot__tried">
                      {t('troubleshoot.tried')}
                    </span>
                  )}
                </div>
                <p>{step.when}</p>
                <p className="troubleshoot__cost">{step.cost}</p>
                {step.detail}
                {step.action && (
                  <button
                    type="button"
                    className={`button small${index === 0 ? '' : ' subtle'}`}
                    onClick={() => {
                      setTried((was) => ({ ...was, [index]: true }));
                      step.action?.run();
                    }}
                  >
                    {step.action.label}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </DialogFrame>
    </div>
  );
}
