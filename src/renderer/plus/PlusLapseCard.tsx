/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { resolveSceneName } from 'common/scenePacks';
import type { ILapsedScene } from 'common/subscription';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { ScenePicture } from './GalleryParts';
import { useGalleryFinder } from './galleryStore';
import GetPlusButton from './GetPlusButton';
import PlusMark from './PlusMark';
import { setBrowseFilters, usePlusNavigation } from './plusNavigation';
import {
  dismissPlusLapse,
  plusOnSale,
  usePlusSubscription,
} from './plusSubscriptionStore';
import SceneGet from './SceneGet';

/** How many of the scenes that stopped the card shows; the rest are counted. */
const SHOWN = 3;

/**
 * One scene that stopped: its picture and the way to keep it with a credit,
 * once the gallery has its listing; until then its name, and a search for it.
 */
function LapsedScene({ lapsed }: { lapsed: ILapsedScene }) {
  const { t, locale } = useTranslation();
  const find = useGalleryFinder();
  const { filters } = usePlusNavigation();
  const scene = find(lapsed.lookId);
  const name = resolveSceneName(lapsed, locale);
  return (
    <div className="plus-lapse__scene">
      {scene ? (
        <ScenePicture scene={scene} className="plus-lapse__picture" />
      ) : (
        <div className="gallery-picture gallery-picture--none plus-lapse__picture">
          <span className="gallery-picture__none" aria-hidden="true">
            <Glyph name="looks" />
          </span>
        </div>
      )}
      <span className="plus-lapse__name" title={name}>
        {name}
      </span>
      {scene ? (
        <SceneGet scene={scene} name={name} className="button small subtle" />
      ) : (
        <button
          type="button"
          className="button small subtle"
          onClick={() => setBrowseFilters({ ...filters, text: name })}
        >
          {t('subscription.lapse.find')}
        </button>
      )}
    </div>
  );
}

/**
 * When Plus ended: which scenes stopped (their downloads deleted, as the
 * terms say), each with the way to keep it with a credit, and Plus again for
 * all of them. Kept until put away, or until the account has Plus again
 * (`ILapseOffer`); a scene got with a credit since leaves it.
 */
export default function PlusLapseCard() {
  const { t } = useTranslation();
  const plus = usePlusSubscription();
  const lapse = plus?.subscribed ? undefined : plus?.lapse;
  if (!plus || !lapse || lapse.scenes.length === 0) {
    return null;
  }
  const more = lapse.scenes.length - SHOWN;
  return (
    <section className="plus-lapse" aria-labelledby="plus-lapse-title">
      <div className="plus-lapse__words">
        <h3 id="plus-lapse-title" className="plus-lapse__title">
          <PlusMark />
          {t('subscription.lapse.title')}
        </h3>
        <p className="plus-lapse__body">{t('subscription.lapse.body')}</p>
        <div className="plus-lapse__actions">
          {plusOnSale(plus) && (
            <GetPlusButton
              label={t('subscription.getAgain')}
              className="button small"
            />
          )}
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              dismissPlusLapse(lapse.id).catch(() => undefined);
            }}
          >
            {t('subscription.lapse.notNow')}
          </button>
        </div>
      </div>
      <div className="plus-lapse__scenes">
        {lapse.scenes.slice(0, SHOWN).map((lapsed) => (
          <LapsedScene key={lapsed.lookId} lapsed={lapsed} />
        ))}
        {more > 0 && (
          <span className="plus-lapse__more">
            {t('subscription.lapse.more', { count: String(more) })}
          </span>
        )}
      </div>
    </section>
  );
}
