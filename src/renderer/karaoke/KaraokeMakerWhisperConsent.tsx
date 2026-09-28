/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { WHISPER_MODEL } from './makerAi';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from '../components/DialogFrame';

/**
 * Asking before the speech model is downloaded.
 *
 * The model is hundreds of megabytes and everything about it runs on the user's
 * own machine — which is the point, and also why it is worth asking rather than
 * simply fetching. The prompt names the model so the answer is about something
 * specific.
 *
 * The two refs arrive rather than being set here. Whether the run came from the
 * lyrics dialog and whether it should continue into the melody are decisions
 * made before the question is asked; consenting only unblocks them.
 */
export interface IKaraokeMakerWhisperConsentProps {
  setWhisperConsentOpen: Dispatch<SetStateAction<boolean>>;
  setLyricsWorkflowActive: Dispatch<SetStateAction<boolean>>;
  /** True when the lyrics dialog started this run rather than the toolbar. */
  lyricsWorkflowActiveRef: MutableRefObject<boolean>;
  /** True when finishing should go straight on to detecting the melody. */
  prepareAfterWhisperRef: MutableRefObject<boolean>;
  runWhisper: () => Promise<void>;
}

const KaraokeMakerWhisperConsent = ({
  lyricsWorkflowActiveRef,
  prepareAfterWhisperRef,
  runWhisper,
  setLyricsWorkflowActive,
  setWhisperConsentOpen,
}: IKaraokeMakerWhisperConsentProps) => {
  const { t } = useTranslation();
  // Not now, and the ×: nothing is fetched, and the run that asked is
  // released rather than left waiting on an answer that is not coming.
  const decline = () => {
    prepareAfterWhisperRef.current = false;
    lyricsWorkflowActiveRef.current = false;
    setLyricsWorkflowActive(false);
    setWhisperConsentOpen(false);
  };
  return (
    <div className="karaoke-maker__modal-backdrop" role="presentation">
      <DialogFrame
        className="karaoke-maker__consent-modal"
        icon={<MenuIcon name="download" />}
        eyebrow={t('karaoke.maker.transcriptionEyebrow')}
        title={t('karaoke.maker.transcriptionTitle')}
        titleId="karaoke-maker-consent-title"
        closeLabel={t('support.close')}
        onClose={decline}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={decline}
            >
              {t('karaoke.maker.notNow')}
            </button>
            <button
              type="button"
              className="button small"
              onClick={() => runWhisper().catch(() => undefined)}
            >
              {t('karaoke.maker.downloadPrepare')}
            </button>
          </div>
        }
      >
        <p>
          {t('karaoke.maker.transcriptionBody', {
            model: WHISPER_MODEL,
          })}
        </p>
        <p>{t('karaoke.maker.transcriptionReview')}</p>
      </DialogFrame>
    </div>
  );
};

export default KaraokeMakerWhisperConsent;
