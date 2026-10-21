import Glyph from '../community/Glyph';
import { usePlusEntitled } from './GalleryParts';
import { PlusFreeIntro, PlusTrialCard } from './PlusTrialCard';
import { usePlusTrial } from './trialStore';

/**
 * Stays inside the gallery; never interrupts the free app. What the free app
 * is and how scenes are got, for an account without Plus, and a free trial
 * already taken while it runs or once it has ended.
 */
export default function PlusTrialBanner({
  onKeepFree,
}: {
  onKeepFree: () => void;
}) {
  const { offer, owner } = usePlusTrial();
  const entitled = usePlusEntitled();
  const showTrial = offer && ['active', 'ended'].includes(offer.state);
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
        </div>
      )}
      {showTrial && (
        <PlusTrialCard key={owner} offer={offer} onKeepFree={onKeepFree} />
      )}
    </section>
  );
}
