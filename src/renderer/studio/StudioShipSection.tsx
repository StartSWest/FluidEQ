import { useId, type ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';

/**
 * The card at the foot of the side column, around whichever of the three
 * share insides the bench chose (`StudioShipCard`, `StudioShipMaker`,
 * `StudioShipInspect`).
 *
 * Pinned to the foot of the column and never folded: these are the actions a
 * scene ends at, and one of the two folds in the column was a way of hiding
 * them. What folds is a group of settings inside the card above
 * (`StudioCardGroup.tsx`).
 */
export default function StudioShipSection({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className="studio-card studio-ship-card" aria-labelledby={titleId}>
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.ship.title')}
      </span>
      {children}
    </section>
  );
}
