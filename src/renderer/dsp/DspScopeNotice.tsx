/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the rack is actually processing, said at the top of the page — when
 * there is something to say.
 *
 * Under Equalizer APO the rack runs inside the Library player and nothing
 * else on the machine is touched — a user who assumes otherwise reports the
 * feature as broken rather than as misunderstood, which is why that sentence
 * has always been body text here rather than a tooltip. And while FluidEQ is
 * switched off or the engine is not running, the rack runs nowhere under the
 * FluidEQ Engine, and the line says that and why.
 *
 * With the rack running under the FluidEQ Engine it says nothing. It used to
 * name the output in a pill, "System-wide · Speakers (…)": the same good news
 * on every visit, in a line of the page that is shortest of room. Ivan took
 * it out on 2026-09-22 ("remove the speaker thing from the UI, no need"); the
 * output is named in the sound panel, where it is chosen.
 *
 * One strip for every case: the glyph of what it is about, the sentence, and
 * the way out as a real button at its end. It was an amber paragraph with a
 * link wrapped onto a line of its own under it, which read as an error left
 * on the page rather than as something to act on (Ivan, 2026-09-22).
 *
 * Its own file rather than more of `DspPanel.tsx`, which is already past the
 * project's 500-line limit.
 */

import type { ReactNode } from 'react';
import type { IAudioEngineStatus } from '../../common/audioEngine';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import type { TRackSuspension } from './rackPlacement';

interface IDspScopeNoticeProps {
  status: IAudioEngineStatus | undefined;
  /**
   * Why the rack is off everywhere, under the FluidEQ Engine — FluidEQ
   * switched off, or the engine not running (`rackPlacement.ts`). Said in
   * place of the scope, because while it holds the rack has none.
   */
  suspension: TRackSuspension | undefined;
  /** False while nothing is playing through the Library player. */
  isRackEngaged: boolean;
  /** Absent until the engine dialog exists; the button renders only with it. */
  onOpenEngineDialog?: () => void;
}

interface IScopeStripProps {
  icon: MenuIconName;
  /**
   * Amber, the page's "not now" rather than a fault: the rack is intact and
   * does its work the moment what it waits for arrives.
   */
  isWaiting: boolean;
  children: string;
  action?: ReactNode;
}

const ScopeStrip = ({
  icon,
  isWaiting,
  children,
  action,
}: IScopeStripProps) => (
  <div className={`dsp-scope${isWaiting ? ' is-idle' : ''}`} role="status">
    <MenuIcon name={icon} className="dsp-scope__icon" />
    <p className="dsp-scope__text">{children}</p>
    {action}
  </div>
);

const SUSPENSION = {
  'sharing-raw': { label: 'dsp.scope.rawSender', icon: 'waveform' },
  'switched-off': { label: 'dspOff.switchedOff', icon: 'power' },
  'engine-off': { label: 'dspOff.engineOff', icon: 'chip' },
} as const;

const DspScopeNotice = ({
  status,
  suspension,
  isRackEngaged,
  onOpenEngineDialog,
}: IDspScopeNoticeProps) => {
  const { t } = useTranslation();
  const power = useEqualizerPower();

  if (suspension !== undefined) {
    const { label, icon } = SUSPENSION[suspension];
    return (
      <ScopeStrip
        icon={icon}
        isWaiting
        action={
          suspension === 'switched-off' ? (
            // The loud style: switching FluidEQ back on is what the line
            // exists to suggest.
            <button
              type="button"
              className="button small dsp-scope__action"
              disabled={power.isBlockingError}
              onClick={() => {
                power.toggle().catch(() => undefined);
              }}
            >
              {t('dspOff.turnOn')}
            </button>
          ) : undefined
        }
      >
        {t(label)}
      </ScopeStrip>
    );
  }

  // Nothing until main has said which engine runs, and nothing once it has
  // said the FluidEQ Engine (see the top of this file). Falling through to the
  // sentence below meant "Library only", in amber, under the title of a page
  // whose rack was running on every output — for as long as main took to
  // answer, which is a helper run and a hash of the engine files.
  if (status === undefined || status.engine === 'fluid') {
    return null;
  }

  return (
    <ScopeStrip
      icon="album"
      isWaiting={!isRackEngaged}
      action={
        onOpenEngineDialog ? (
          // The way to have the rack on everything, offered where the
          // limitation is stated rather than left to be found in a menu.
          <button
            type="button"
            className="button small dsp-scope__action"
            onClick={onOpenEngineDialog}
          >
            {t('dsp.scope.useFluid')}
          </button>
        ) : undefined
      }
    >
      {t(!isRackEngaged ? 'dsp.idle' : 'dsp.scopeNotice')}
    </ScopeStrip>
  );
};

export default DspScopeNotice;
