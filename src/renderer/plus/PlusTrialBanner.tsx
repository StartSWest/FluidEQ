import { isCheckoutConfigured } from 'common/accountConfig';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph from '../community/Glyph';
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
    <section className="plus-trial-banner">
      {!entitled && (
        <div className="plus-trial-banner__overview">
          <div className="plus-trial-banner__message">
            <span className="plus-trial-banner__mark" aria-hidden="true">
              <Glyph name="headphones" />
            </span>
            <PlusFreeIntro compact />
          </div>
          {!showTrial && isCheckoutConfigured() && (
            <button
              type="button"
              className="button small subtle plus-trial-banner__plans"
              onClick={() => requestAccountPanel('subscribe')}
            >
              <span>{t('trial.ended.plans')}</span>
              <Glyph name="next" />
            </button>
          )}
        </div>
      )}
      {showTrial && (
        <PlusTrialCard key={owner} offer={offer} onKeepFree={onKeepFree} />
      )}
    </section>
  );
}
