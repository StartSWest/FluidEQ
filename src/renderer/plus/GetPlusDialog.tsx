/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SCENE_PRICE_CREDITS } from 'common/sceneStore';
import type { ILibraryPlan, TLibraryPlanId } from 'common/subscription';
import type { IGalleryScene } from 'common/plusGallery';
import DialogFrame from '../components/DialogFrame';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import { creditsText } from './credits';
import { ScenePicture } from './GalleryParts';
import { useGalleryList } from './galleryStore';
import { OPENING_SORT, openPlusPlace } from './plusNavigation';
import PlusMark from './PlusMark';
import { holdPlusSheet, usePlusSubscription } from './plusSubscriptionStore';
import { planName, planNote, planPriceText, planSaving } from './plusWords';
import BuySceneDialog from './BuySceneDialog';
import { addGalleryScene } from './galleryActions';
import StoreTermsDialog from './StoreTermsDialog';
import { useGetPlusCheckout, useManagePlus } from './useGetPlus';
import '../styles/Gallery.scss';

/** How many of the newest scenes stand behind the sheet's rail. */
const RAIL_PICTURES = 10;

/**
 * The newest scenes in Scenes, tilted behind the rail: what Plus is, said
 * with the scenes themselves. Pictures only, never a scene running. A
 * gallery with fewer than the wall holds goes round again, so the rail is
 * covered whatever the count.
 */
function PlusRailPictures() {
  const { list } = useGalleryList({ sort: OPENING_SORT });
  const { scenes } = list;
  const wall =
    scenes.length === 0
      ? []
      : Array.from(
          { length: RAIL_PICTURES },
          (_, index) => scenes[index % scenes.length],
        );
  return (
    <div
      className="dialog-frame__scene plus-sheet__pictures"
      aria-hidden="true"
    >
      <div className="plus-sheet__mosaic">
        {wall.map((scene, index) => (
          // A place on the wall is what it is; the wall never reorders.
          // eslint-disable-next-line react/no-array-index-key -- see above
          <ScenePicture key={`${scene.lookId}-${index}`} scene={scene} />
        ))}
      </div>
    </div>
  );
}

/** Plus beside credits, in two columns: the question this sheet must answer. */
function PlusOrCredits() {
  const { t, locale } = useTranslation();
  return (
    <section className="plus-compare" aria-labelledby="plus-compare-title">
      <h3 id="plus-compare-title" className="plus-compare__title">
        {t('subscription.ways.title')}
      </h3>
      <div className="plus-compare__columns">
        <div className="plus-compare__way">
          <span className="plus-compare__name">
            <Glyph name="credit" />
            {t('store.credits.title')}
          </span>
          <span>
            {t('subscription.ways.credits.each', {
              credits: creditsText(t, locale, SCENE_PRICE_CREDITS),
            })}
          </span>
          <span>{t('subscription.ways.credits.keep')}</span>
        </div>
        <div className="plus-compare__way plus-compare__way--plus">
          <span className="plus-compare__name">
            <PlusMark />
            {t('subscription.name')}
          </span>
          <span>{t('subscription.ways.plus.every')}</span>
          <span>{t('subscription.ways.plus.while')}</span>
        </div>
      </div>
    </section>
  );
}

interface IPlanRowsProps {
  plans: readonly ILibraryPlan[];
  selected: TLibraryPlanId | undefined;
  onSelect: (plan: TLibraryPlanId) => void;
  disabled: boolean;
  labelledBy: string;
}

/**
 * The plans on sale, one row each, as the credit packs are: the same rows,
 * so choosing what to pay for looks the same everywhere in the app.
 */
function PlanRows({
  plans,
  selected,
  onSelect,
  disabled,
  labelledBy,
}: IPlanRowsProps) {
  const { t, locale } = useTranslation();
  return (
    <div
      className="dialog-frame__group gallery-report-dialog__reasons store-packs"
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {plans.map((plan) => {
        const id = `plus-plan-${plan.id}`;
        const saving = planSaving(t, plans, plan);
        return (
          <label
            key={plan.id}
            className="gallery-report-dialog__reason store-pack plus-plan"
            htmlFor={id}
          >
            <input
              id={id}
              type="radio"
              name="plus-plan"
              value={plan.id}
              checked={selected === plan.id}
              disabled={disabled}
              onChange={() => onSelect(plan.id)}
            />
            <span className="gallery-report-dialog__radio" aria-hidden="true" />
            <span className="store-pack__what">
              <span className="store-pack__credits">
                {planName(t, plan.id)}
              </span>
              <span className="store-pack__each">
                {planNote(t, plan, locale)}
              </span>
            </span>
            <span className="store-pack__price">
              {planPriceText(t, plan, locale)}
            </span>
            {saving && <span className="store-pack__best">{saving}</span>}
          </label>
        );
      })}
    </div>
  );
}

/**
 * Keeping just the scene a card's Get was pressed on, with a credit, under
 * Plus: the extra, which stays even without Plus. The credit's own dialog,
 * and the scene in the looks the moment it is bought, as `SceneGet` does.
 */
function KeepOne({ scene, name }: { scene: IGalleryScene; name: string }) {
  const { t, locale } = useTranslation();
  const [buying, setBuying] = useState(false);
  return (
    <div className="plus-sheet__keep">
      <span>{t('subscription.sheet.keepOne', { name })}</span>
      <button
        type="button"
        className="button small subtle coin-action store-get"
        onClick={() => setBuying(true)}
      >
        <Glyph name="credit" />
        {t('store.get', {
          credits: creditsText(t, locale, SCENE_PRICE_CREDITS),
        })}
      </button>
      {buying && (
        <BuySceneDialog
          scene={scene}
          name={name}
          onClose={(bought) => {
            setBuying(false);
            if (bought) {
              addGalleryScene(scene, name).catch(() => undefined);
            }
          }}
        />
      )}
    </div>
  );
}

interface IGetPlusDialogProps {
  /** The plan to start on, when the press that opened it named one. */
  plan?: TLibraryPlanId;
  /**
   * The scene a card's Get was pressed on: kept for good with a credit is
   * offered under Plus, as the extra it is.
   */
  keep?: { scene: IGalleryScene; name: string };
  onClose: () => void;
}

/**
 * Get Plus: the plans, what Plus is against credits, what happens when it
 * ends, and the way to Stripe's page. Paying records an agreement to the
 * terms shown here (main sends this build's revision with the checkout), so
 * they are one press away beside the button.
 *
 * Stripe's page opens in the browser and the sheet stays, waiting on the
 * account itself: the moment main says it has Plus, the sheet says so.
 */
export default function GetPlusDialog({
  plan,
  keep,
  onClose,
}: IGetPlusDialogProps) {
  const { t } = useTranslation();
  const ids = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const plus = usePlusSubscription();
  const [readingTerms, setReadingTerms] = useState(false);
  const close = useCallback(() => onClose(), [onClose]);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: close });
  useEffect(() => holdPlusSheet(), []);

  if (!plus) {
    return null;
  }
  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="plus-sheet"
        icon={<PlusMark />}
        eyebrow={t('subscription.sheet.eyebrow')}
        title={t('subscription.get')}
        titleId={`${ids}-title`}
        description={t('subscription.sheet.description')}
        rail={<PlusRailPictures />}
        closeLabel={t('support.close')}
        onClose={close}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={closeRef}
              type="button"
              className="button small subtle"
              onClick={close}
            >
              {t('subscription.sheet.notNow')}
            </button>
          </div>
        }
      >
        <GetPlusBody
          plan={plan}
          keep={keep}
          plansId={`${ids}-plans`}
          onReadTerms={() => setReadingTerms(true)}
          onDone={() => {
            close();
            openPlusPlace('visualizers');
          }}
        />
        {readingTerms && (
          <StoreTermsDialog onClose={() => setReadingTerms(false)} />
        )}
      </DialogFrame>
    </div>,
    document.body,
  );
}

interface IGetPlusBodyProps {
  plan: TLibraryPlanId | undefined;
  keep: IGetPlusDialogProps['keep'];
  plansId: string;
  onReadTerms: () => void;
  onDone: () => void;
}

/** The sheet's body as the checkout stands: choosing, waiting, or done. */
function GetPlusBody({
  plan,
  keep,
  plansId,
  onReadTerms,
  onDone,
}: IGetPlusBodyProps) {
  const { t, locale } = useTranslation();
  const plus = usePlusSubscription();
  // The hooks run whatever the state, so the sheet keeps its place in the
  // checkout while main's answer changes under it.
  const manage = useManagePlus();
  const checkout = useGetPlusCheckout(
    plus ?? { signedIn: true, plans: [], subscribed: false, manageable: false },
    plan,
  );
  if (!plus) {
    return null;
  }
  if (checkout.done) {
    return (
      <div className="plus-sheet__done" role="status">
        <PlusMark className="plus-sheet__done-mark" />
        <h3 className="plus-sheet__heading">
          {t('subscription.sheet.done.title')}
        </h3>
        <p>{t('subscription.sheet.done.body')}</p>
        <button type="button" className="button" onClick={onDone}>
          {t('subscription.sheet.done.see')}
        </button>
      </div>
    );
  }
  const chosen = plus.plans.find((each) => each.id === checkout.selected);
  return (
    <>
      <h3 className="plus-sheet__heading">{t('subscription.sheet.heading')}</h3>
      <p className="plus-sheet__lead">{t('subscription.sheet.lead')}</p>
      {plus.plans.length === 0 ? (
        <p className="store-status">
          {t(
            plus.suspended
              ? 'subscription.error.banned'
              : 'subscription.error.notOnSale',
          )}
        </p>
      ) : (
        <>
          <span id={plansId} className="gallery-dialog__label">
            {t('subscription.sheet.choose')}
          </span>
          <PlanRows
            plans={plus.plans}
            selected={checkout.selected}
            onSelect={checkout.select}
            disabled={checkout.opening}
            labelledBy={plansId}
          />
        </>
      )}
      <PlusOrCredits />
      <ul className="plus-sheet__facts">
        <li>
          <Glyph name="refresh" />
          {t('subscription.sheet.renews')}
        </li>
        <li>
          <Glyph name="alert" />
          {t('subscription.sheet.ends')}
        </li>
        <li>
          <PlusMark />
          {t('subscription.sheet.both')}
        </li>
      </ul>
      {chosen && (
        <div className="store-pay">
          {checkout.waiting && (
            <p className="store-status" role="status">
              <span className="store-status__spinner" aria-hidden="true" />
              {t('subscription.sheet.waiting')}
            </p>
          )}
          {/* Loud while paying is the recommendation; quiet once Stripe's
              page is open, where it only opens that page again. */}
          <button
            type="button"
            className={`button store-pay__button plus-pay${
              checkout.waiting ? ' subtle' : ''
            }${checkout.opening ? ' is-running' : ''}`}
            aria-busy={checkout.opening}
            disabled={checkout.opening}
            onClick={checkout.pay}
          >
            <PlusMark />
            {checkout.waiting
              ? t('subscription.sheet.again')
              : t('subscription.sheet.pay', {
                  price: planPriceText(t, chosen, locale),
                })}
          </button>
        </div>
      )}
      {checkout.failure && (
        <p className="gallery-dialog__error" role="alert">
          {t(checkout.failure)}
        </p>
      )}
      {checkout.alreadySubscribed && (
        <button
          type="button"
          className={`button small subtle${manage.busy ? ' is-running' : ''}`}
          aria-busy={manage.busy}
          onClick={manage.manage}
        >
          {t('subscription.manage')}
        </button>
      )}
      {manage.said && (
        <p className="gallery-fine" role="status">
          {t(manage.said)}
        </p>
      )}
      {keep && <KeepOne scene={keep.scene} name={keep.name} />}
      <div className="store-fine">
        <p className="gallery-fine">{t('subscription.sheet.fine')}</p>
        <button
          type="button"
          className="store-fine__terms"
          onClick={onReadTerms}
        >
          {t('terms.link')}
        </button>
      </div>
    </>
  );
}
