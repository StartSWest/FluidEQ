/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { creditsText } from './credits';
import GalleryCard from './GalleryCard';
import { useGalleryList } from './galleryStore';
import { OPENING_SORT, openGalleryPage } from './plusNavigation';
import PlusMark from './PlusMark';
import PlusStatus from './PlusStatus';
import { usePlusSubscription } from './plusSubscriptionStore';
import { keepsLookNow, useSceneStore } from './sceneStore';
import useGalleryLocalScenes from './useGalleryLocalScenes';
import { useManagePlus } from './useGetPlus';
import '../styles/Gallery.scss';

/** How many of the newest scenes the page shows: one row of the gallery. */
const NEW_SCENES = 4;

/**
 * The newest scenes Plus plays: not the member's own, and not one already
 * theirs for good, which is not "with Plus" whatever Plus does.
 */
function NewWithPlus({ me }: { me: string | undefined }) {
  const { t } = useTranslation();
  const { list } = useGalleryList({ sort: OPENING_SORT });
  const localById = useGalleryLocalScenes();
  // Read so the list is drawn again when a scene is got with a credit.
  useSceneStore();
  const scenes = list.scenes
    .filter((scene) => scene.authorId !== me && !keepsLookNow(scene.lookId))
    .slice(0, NEW_SCENES);
  if (scenes.length === 0) {
    return null;
  }
  return (
    <section className="plus-page__new">
      <h3 className="library-section gallery-section-title">
        <span className="library-section__label">
          {t('subscription.page.new')}
        </span>
      </h3>
      <div className="gallery-grid gallery-grid--row">
        {scenes.map((scene) => (
          <GalleryCard
            key={scene.lookId}
            scene={scene}
            me={me}
            local={localById.get(scene.lookId)}
            onOpen={(opened) =>
              openGalleryPage({ kind: 'scene', scene: opened })
            }
            onMaker={(maker) => openGalleryPage({ kind: 'maker', maker })}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Credits beside Plus, each in one line, so nobody has to guess which one
 * they want (Ivan, 2026-11-28: "make sure users doent get confusued if they
 * should get plus or buy credits").
 */
function PlusWays() {
  const { t, locale } = useTranslation();
  const { store } = useSceneStore();
  return (
    <section className="plus-ways" aria-label={t('subscription.ways.title')}>
      <div className="plus-ways__way">
        <Glyph name="credit" />
        <span className="plus-ways__words">
          <span className="plus-ways__name">
            {store
              ? t('subscription.ways.credits.have', {
                  credits: creditsText(t, locale, store.balance),
                })
              : t('store.credits.title')}
          </span>
          <span>{t('subscription.ways.credits.body')}</span>
        </span>
      </div>
      <div className="plus-ways__way plus-ways__way--plus">
        <PlusMark />
        <span className="plus-ways__words">
          <span className="plus-ways__name">{t('subscription.name')}</span>
          <span>{t('subscription.ways.plus.body')}</span>
        </span>
      </div>
    </section>
  );
}

/** Manage Plus, and what the press came to beside it. */
function ManagePlus() {
  const { t } = useTranslation();
  const manage = useManagePlus();
  return (
    <span className="plus-page__manage">
      <button
        type="button"
        className={`button small subtle${manage.busy ? ' is-running' : ''}`}
        aria-busy={manage.busy}
        disabled={manage.busy}
        onClick={manage.manage}
      >
        {t('subscription.manage')}
      </button>
      {manage.said && (
        <span
          className={`plus-page__said${manage.failed ? ' is-failed' : ''}`}
          role="status"
        >
          {t(manage.said)}
        </span>
      )}
    </span>
  );
}

/**
 * Plus's own page, in the Scenes rail under the gallery: the only place in
 * the app where Plus is got, managed and renewed. For a member, the plan and
 * its dates and Manage Plus; for anybody else, the plans and Get Plus; for
 * both, Plus beside credits, and the newest scenes it plays.
 */
export default function PlusPage() {
  const { t } = useTranslation();
  const plus = usePlusSubscription();
  const me = useAccount().identity?.id;
  if (!plus) {
    return (
      <div
        className="gallery-visualizers"
        role="status"
        aria-label={t('account.checking')}
      >
        <span
          className="gallery-preview__spinner plus-page__wait"
          aria-hidden="true"
        />
      </div>
    );
  }
  // A member manages from the head; anybody else gets Plus from the plan
  // they pick in the offer under it, so the head holds no second Get Plus.
  return (
    <div className="gallery-visualizers">
      <div className="gallery-page plus-page">
        <header className="plus-page__head">
          <PlusMark className="plus-page__emblem" />
          <div className="plus-page__heading">
            <h2 className="plus-page__title">{t('subscription.name')}</h2>
            <p className="plus-page__lead">{t('subscription.page.lead')}</p>
          </div>
          {plus.subscribed && plus.manageable && <ManagePlus />}
        </header>
        <PlusStatus plus={plus} />
        <PlusWays />
        <NewWithPlus me={me} />
      </div>
    </div>
  );
}
