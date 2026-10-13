import { useState } from 'react';
import type { ErrorDescription } from '../../../common/errors';
import { engineKeepsEars } from '../../../common/engineHealth';
import { useFluidEqContext } from '../../utils/FluidEqContext';
import { useKnownAudioEngineStatus } from '../../utils/useAudioEngineStatus';
import { useTranslation } from '../../utils/I18nContext';
import { setChannelsApart as sendChannelsApart } from '../../utils/equalizerEditApi';

/**
 * Your EQ's Channels row: every band on both ears, or each on the ear it
 * names (Ivan, 2026-10-13, "EQ per channel"). Beside the other ways the EQ is
 * built, in the menu's own segmented track, and for this output alone.
 */
const EqChannelsRow = () => {
  const { t } = useTranslation();
  const { channelsApart, setChannelsApart, setEditingEar, setGlobalError } =
    useFluidEqContext();
  const [isPending, setIsPending] = useState(false);
  // What the window already holds, never a new ask on opening the menu.
  const status = useKnownAudioEngineStatus();
  // Equalizer APO has always read `Channel:`; the FluidEQ Engine from 1.21.
  const isEngineBehind =
    status?.engine === 'fluid' && !engineKeepsEars(status.fluid?.dllVersion);

  const choose = async (apart: boolean) => {
    if (apart === channelsApart || isPending) {
      return;
    }
    // Shown at once, put back if main refuses it: a switch that waits on a
    // config write before it moves reads as a press that did nothing.
    setChannelsApart(apart);
    if (!apart) {
      setEditingEar('both');
    }
    setIsPending(true);
    try {
      await sendChannelsApart(apart);
    } catch (error) {
      setChannelsApart(!apart);
      // The request rejects with main's own description, as every setter
      // on this page reads it (`setterResponseHandler`).
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsPending(false);
    }
  };

  const options = [
    { apart: false, text: t('eq.channels.linked') },
    { apart: true, text: t('eq.channels.apart') },
  ];

  return (
    <div className="eq-mode-choices__row eq-mode-choices__row--channels">
      <span className="eq-mode-choices__label">{t('eq.channels.title')}</span>
      <div
        className="segmented eq-mode-choices__track"
        role="group"
        aria-label={t('eq.channels.title')}
      >
        {options.map((option) => (
          <button
            type="button"
            key={String(option.apart)}
            className={`segmented__option eq-mode-choice${
              channelsApart === option.apart ? ' is-selected' : ''
            }`}
            aria-pressed={channelsApart === option.apart}
            aria-busy={isPending && channelsApart === option.apart}
            onClick={() => {
              choose(option.apart).catch(() => undefined);
            }}
          >
            <span className="eq-mode-choice__label">{option.text}</span>
          </button>
        ))}
      </div>
      <p className="eq-mode-choices__note">
        {t(
          channelsApart && isEngineBehind
            ? 'eq.channels.update'
            : 'eq.channels.note',
        )}
      </p>
    </div>
  );
};

export default EqChannelsRow;
