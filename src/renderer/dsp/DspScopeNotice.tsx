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
 * Its own file rather than more of `DspPanel.tsx`, which is already past the
 * project's 500-line limit.
 */

import type { IAudioEngineStatus } from '../../common/audioEngine';
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
  /** Absent until the engine dialog exists; the link renders only with it. */
  onOpenEngineDialog?: () => void;
}

const DspScopeNotice = ({
  status,
  suspension,
  isRackEngaged,
  onOpenEngineDialog,
}: IDspScopeNoticeProps) => {
  const { t } = useTranslation();
  const power = useEqualizerPower();

  if (suspension !== undefined) {
    const suspensionLabel = {
      'sharing-raw': 'dsp.scope.rawSender',
      'switched-off': 'dspOff.switchedOff',
      'engine-off': 'dspOff.engineOff',
    } as const;
    // Amber, the page's "not now" rather than a fault: the rack is intact and
    // comes back as it was the moment FluidEQ, or the engine, does.
    return (
      <p className="dsp-scope is-idle" role="status">
        {t(suspensionLabel[suspension])}
        {suspension === 'switched-off' ? (
          <button
            type="button"
            className="link-button dsp-scope-link"
            disabled={power.isBlockingError}
            onClick={() => {
              power.toggle().catch(() => undefined);
            }}
          >
            {t('dspOff.turnOn')}
          </button>
        ) : undefined}
      </p>
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
    <p className={`dsp-scope${!isRackEngaged ? ' is-idle' : ''}`}>
      {t(!isRackEngaged ? 'dsp.idle' : 'dsp.scopeNotice')}
      {onOpenEngineDialog ? (
        <button
          type="button"
          className="link-button dsp-scope-link"
          onClick={onOpenEngineDialog}
        >
          {t('dsp.scope.useFluid')}
        </button>
      ) : undefined}
    </p>
  );
};

export default DspScopeNotice;
