/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { TKaraokeMakerWizardStep } from './KaraokeMakerWizard';
import { KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED } from './makerAi';
import {
  type IKaraokeMakerProject,
  karaokeMakerHasCompleteTiming,
} from '../../common/karaoke/makerProject';
import { type IKaraokeSong } from '../../common/karaoke/types';

interface IMakerWizardOfferInput {
  song: IKaraokeSong;
  project: IKaraokeMakerProject;
}

/**
 * Whether the set-up wizard is offered, and where a run of it stands: the
 * step running and the steps done. Offered once per opening, and only for a
 * song with nothing timed yet and no stems restored from disk.
 */
const useMakerWizardOffer = ({ song, project }: IMakerWizardOfferInput) => {
  // Offered once per opening, and only for a song with nothing timed yet. The
  // ref stops a re-render from re-opening a dialog the user has dismissed.
  const wizardOfferedRef = useRef(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<TKaraokeMakerWizardStep>();
  const [wizardDone, setWizardDone] = useState<TKaraokeMakerWizardStep[]>([]);

  useEffect(() => {
    // A song whose stems were restored from disk has already been set up
    // once. Re-offering because the *transcription* half is unfinished read
    // as the app forgetting the split it just recovered — and because the
    // restore is asynchronous, the offer can already be on screen when the
    // stems arrive, so an open idle wizard is withdrawn rather than left up.
    if (song.assets.some((asset) => asset.role === 'vocals')) {
      if (wizardStep === undefined) {
        setWizardOpen(false);
      }
      wizardOfferedRef.current = true;
      return;
    }
    if (
      !KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED ||
      wizardOfferedRef.current ||
      karaokeMakerHasCompleteTiming(project.lyrics.lines)
    ) {
      return;
    }
    wizardOfferedRef.current = true;
    setWizardOpen(true);
  }, [project.lyrics.lines, song.assets, wizardStep]);

  return {
    wizardOpen,
    setWizardOpen,
    wizardStep,
    setWizardStep,
    wizardDone,
    setWizardDone,
  };
};

export default useMakerWizardOffer;
