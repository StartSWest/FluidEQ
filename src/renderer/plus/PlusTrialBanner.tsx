import { isCheckoutConfigured } from 'common/accountConfig';
import { requestAccountPanel } from '../account/accountPanel';
import { useTranslation } from '../utils/I18nContext';
import { usePlusEntitled } from './GalleryParts';
import { PlusFreeIntro, PlusTrialCard } from './PlusTrialCard';
import { usePlusTrial } from './trialStore';

/** Stays inside the Plus gallery; never interrupts the free app. */
export default function PlusTrialBanner({
  onKeepFree,
}: {
  onKeepFree: () => void;
}) {
  const { t } = useTranslation();
  const { offer, owner } = usePlusTrial();
  const entitled = usePlusEntitled();
  const showTrial =
    offer && ['eligible', 'active', 'ended'].includes(offer.state);
  if (entitled && !showTrial) {
    return null;
  }
  return (
    <div className="plus-trial-banner">
      {!entitled && <PlusFreeIntro compact />}
      {showTrial ? (
        <PlusTrialCard key={owner} offer={offer} onKeepFree={onKeepFree} />
      ) : (
        !entitled &&
        isCheckoutConfigured() && (
          <div className="plus-trial__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={() => requestAccountPanel('subscribe')}
            >
              {t('trial.ended.plans')}
            </button>
          </div>
        )
      )}
    </div>
  );
}
