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
import { PRODUCT_NAME } from 'common/branding';
import type { TAudioEngine } from 'common/audioEngine';
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
  /**
   * The label for that step, translated by the shell.
   *
   * Handed in rather than looked up here because this file's own copy is
   * still English: localising the whole troubleshooter is a job of its own,
   * and a half-translated panel is worse than a consistently English one.
   */
  enableEngineLabel: string;
}

interface IStep {
  title: string;
  /** The symptom this one actually addresses. */
  when: string;
  cost: string;
  /**
   * `quiet` is for a step that removes something rather than repairing it:
   * the panel recommends its repairs, so an undo must not wear their
   * emphasis.
   */
  action?: { label: string; run: () => void; quiet?: boolean };
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
  enableEngineLabel,
}: IAudioTroubleshooterProps) {
  // Which steps have been tried, so somebody working down the list can see
  // where they are. Not persisted and not authoritative — it is a reminder,
  // not a record, and any of them can be run again.
  const [tried, setTried] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
      title: 'Re-select your devices in Equalizer APO',
      when:
        'One device is equalised and another is not, or a headset you have ' +
        'just plugged in is being ignored. Equalizer APO attaches to each ' +
        'output separately, and a new device is not attached until you tick ' +
        'it.',
      cost: 'Opens Equalizer APO’s Device Selector. A restart afterwards.',
      action: { label: 'Open Device Selector', run: onReconfigure },
    },
    {
      title: 'Try the other installation mode',
      when:
        'A device is ticked in the Device Selector and still has no effect, ' +
        'or ticking it makes that device stop playing altogether. Equalizer ' +
        'APO can attach itself to Windows audio in two different ways, and ' +
        'some hardware only works with one of them.',
      cost: 'A restart. Reversible — switch back the same way.',
      action: { label: 'Open Device Selector', run: onReconfigure },
      detail: (
        <p>
          In the Device Selector, open <strong>Troubleshooting options</strong>.
          The default is to install as an <strong>APO</strong>, which is the one
          that works on most machines. <strong>Install as SFX/EFX</strong> is
          the alternative, and it is what to reach for on devices whose drivers
          bring their own effects — a lot of laptop and gaming audio. If a
          device stopped working after you ticked it, try the other mode before
          concluding it cannot be equalised.
        </p>
      ),
    },
    {
      title: 'Reinstall Equalizer APO',
      when:
        'The first two changed nothing, or Windows updated and the ' +
        'equaliser has not worked since. Its installer is also its repair ' +
        'tool: it re-registers the audio component and reopens the device ' +
        'list.',
      cost:
        'Administrator permission, and your computer needs to restart ' +
        `afterwards. Your ${PRODUCT_NAME} profiles and presets are not touched.`,
      action: { label: 'Reinstall Equalizer APO', run: onReinstallApo },
    },
    {
      title: 'Remove the device, restart, add it back',
      when:
        'Only if a specific device is still wrong after a reinstall. ' +
        'Untick it in the Device Selector, restart the computer, then tick ' +
        'it again and restart once more.',
      cost: 'Two restarts.',
      detail: (
        <p>
          The two restarts are not superstition. Equalizer APO attaches itself
          to an audio endpoint as the machine starts, so a device that is
          detached while Windows is running stays half-attached until it is not
          — and adding it back before that has happened puts the broken state
          straight back.
        </p>
      ),
    },
  ];

  const engineSteps: IStep[] = [
    {
      title: `Put the ${PRODUCT_NAME} Engine back on your outputs`,
      when:
        'One device is equalised and another is not, or a headset you have ' +
        'just plugged in is being ignored. The engine attaches to each ' +
        'output separately, and a Windows update can detach it from one it ' +
        'was already on.',
      cost:
        'Windows asks for permission, and audio restarts for a moment. No ' +
        'reboot.',
      action: { label: enableEngineLabel, run: onEnableEngine },
    },
    {
      title: `Remove the ${PRODUCT_NAME} Engine from this output`,
      when:
        'This one output is wrong in a way none of the above fixes, or you ' +
        'want to hand it back to another audio program. The engine comes off ' +
        'the output Windows is playing through right now, and whatever it ' +
        'replaced goes back on.',
      cost:
        'Windows asks for permission, and audio restarts for a moment. Your ' +
        'other outputs are untouched, and the step above puts it back.',
      action: {
        label: 'Remove from this output',
        run: onRemoveEngineFromOutput,
        quiet: true,
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
      title: 'Restart Windows Audio',
      when:
        'Sound has stopped, or the graph has gone flat while something is ' +
        'playing. This is the fix for almost every case, and the one to try ' +
        'first.',
      cost: 'A few seconds of silence. Windows asks for permission.',
      action: { label: 'Restart audio', run: onRestartAudio },
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
      <div
        className="troubleshoot"
        role="dialog"
        aria-modal="true"
        aria-label="Fix audio problems"
      >
        <div className="troubleshoot__head">
          <h2>Fix audio problems</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <p className="troubleshoot__lead">
          Work down the list and stop at the first one that helps. Each is more
          disruptive than the last, and the first fixes most problems.
        </p>

        <ol className="troubleshoot__steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={tried[index] ? 'is-tried' : undefined}
            >
              <div className="troubleshoot__step-head">
                <h3>{step.title}</h3>
                {tried[index] && (
                  <span className="troubleshoot__tried">Tried</span>
                )}
              </div>
              <p className="troubleshoot__when">{step.when}</p>
              <p className="troubleshoot__cost">{step.cost}</p>
              {step.detail}
              {step.action && (
                <button
                  type="button"
                  className={
                    step.action.quiet
                      ? 'troubleshoot__action troubleshoot__action--quiet'
                      : 'troubleshoot__action'
                  }
                  onClick={() => {
                    setTried((was) => ({ ...was, [index]: true }));
                    step.action?.run();
                  }}
                >
                  {step.action.label}
                </button>
              )}
            </li>
          ))}
        </ol>

        <p className="troubleshoot__foot">
          Still wrong after all of that? Use <strong>Report a problem</strong>{' '}
          in the same menu — it collects the logs, with anything identifying you
          stripped out, and shows you the whole thing before it goes anywhere.
        </p>
      </div>
    </div>
  );
}
