/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  onClose: () => void;
  onRestartAudio: () => void;
  onReconfigure: () => void;
  onReinstallApo: () => void;
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
  onClose,
  onRestartAudio,
  onReconfigure,
  onReinstallApo,
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
      title: 'Reinstall Equalizer APO',
      when:
        'The first two changed nothing, or Windows updated and the ' +
        'equaliser has not worked since. Its installer is also its repair ' +
        'tool: it re-registers the audio component and reopens the device ' +
        'list.',
      cost:
        'Administrator permission, and your computer needs to restart ' +
        'afterwards. Your FluidEQ profiles and presets are not touched.',
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
                  className="troubleshoot__action"
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
