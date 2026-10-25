/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useMemo, useState } from 'react';
import { OPRA_SOURCE_ID, type IOpraProduct } from 'common/constants';
import type { ErrorDescription } from 'common/errors';
import { useFluidEqContext } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import { importEqText, loadOpraPreset } from '../../utils/equalizerApi';
import EqModeIcon from '../../icons/EqModeIcon';
import RichPick, { type IRichPickEntry } from '../../widgets/RichPick';
import { IMPORT_EAR_NAMES } from '../../eq/ImportEarsPick';
import { isCurveApplied } from '../../eq/appliedCurve';
import { SOURCE_NAMES } from '../../eq/MyCurveRow';
import { useMyCurves } from '../../eq/myCurvesStore';
import {
  knownOpraProducts,
  loadOpraProducts,
  opraProductLabel,
} from '../../opraProducts';

const MINE = 'mine:';
const OPRA = 'opra:';
const GROUP_MINE = 'mine';
const GROUP_OPRA = 'opra';

const Glyph = () => (
  <span className="rich-pick__glyph">
    <EqModeIcon kind="curves" />
  </span>
);

/**
 * The headphone correction playing, picked from the EQ mode card's
 * Corrections tab: the listener's own curves first, then the OPRA library's
 * curves for the headphone playing, and the arrows either side step through
 * both, so comparing two corrections is one press (Ivan, 2026-10-20: "switch
 * between them fast"). Whatever is picked plays exactly as it would from its
 * own page — a curve of yours through the correction import, an OPRA curve
 * through the library — so each output keeps the one it plays, as it keeps
 * everything else.
 */
export default function CorrectionQuickPick() {
  const { t } = useTranslation();
  const {
    headphone,
    headset,
    headsetSource,
    headsetTarget,
    isBlockingError,
    refreshState,
    setGlobalError,
  } = useFluidEqContext();
  const curves = useMyCurves();
  const [products, setProducts] = useState<readonly IOpraProduct[]>(
    () => knownOpraProducts() ?? [],
  );
  const [isApplying, setApplying] = useState(false);
  const isOpraPlaying = headsetSource === OPRA_SOURCE_ID && Boolean(headset);

  // The library's index is read once per window (`opraProducts.ts`); it is
  // only needed here when one of its curves is playing.
  useEffect(() => {
    if (!isOpraPlaying || products.some((entry) => entry.id === headset)) {
      return undefined;
    }
    let isCurrent = true;
    loadOpraProducts()
      .then((entries) => {
        if (isCurrent) {
          setProducts(entries);
        }
        return undefined;
      })
      .catch((error) => setGlobalError(error as ErrorDescription));
    return () => {
      isCurrent = false;
    };
  }, [headset, isOpraPlaying, products, setGlobalError]);

  const product = isOpraPlaying
    ? products.find((entry) => entry.id === headset)
    : undefined;

  const entries = useMemo((): IRichPickEntry[] => {
    const mine = curves.map((curve) => ({
      id: `${MINE}${curve.id}`,
      name: curve.name,
      hint: `${t(SOURCE_NAMES[curve.source])} · ${t(IMPORT_EAR_NAMES[curve.ears])}`,
      group: GROUP_MINE,
      icon: <Glyph />,
    }));
    const opra = (product?.curves ?? []).map((curve) => ({
      id: `${OPRA}${curve.id}`,
      name: curve.details,
      hint: t('opra.createdBy', { author: curve.author }),
      group: GROUP_OPRA,
      icon: <Glyph />,
    }));
    return [...mine, ...opra];
  }, [curves, product, t]);

  // What plays now: an OPRA curve by the library's own ids; otherwise a
  // curve of yours by its text, whichever tab played it (`appliedCurve.ts`).
  const mineId = curves.find((curve) =>
    isCurveApplied(curve.text, headphone),
  )?.id;
  let activeId = '';
  if (isOpraPlaying && headsetTarget) {
    activeId = `${OPRA}${headsetTarget}`;
  } else if (mineId) {
    activeId = `${MINE}${mineId}`;
  }

  const play = async (id: string) => {
    if (id === activeId) {
      return;
    }
    setApplying(true);
    try {
      if (id.startsWith(MINE)) {
        const curve = curves.find((entry) => `${MINE}${entry.id}` === id);
        if (!curve) {
          return;
        }
        await importEqText(curve.text, curve.name, 'curve', 'both');
      } else if (product) {
        await loadOpraPreset(product.id, id.slice(OPRA.length));
      }
      await refreshState();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setApplying(false);
    }
  };

  const step = (by: number) => {
    if (entries.length === 0) {
      return;
    }
    const at = entries.findIndex((entry) => entry.id === activeId);
    const next =
      at < 0
        ? entries[by > 0 ? 0 : entries.length - 1]
        : entries[(at + by + entries.length) % entries.length];
    play(next.id).catch(() => undefined);
  };

  if (entries.length === 0) {
    return null;
  }
  const isOff = isBlockingError || isApplying;
  return (
    <div className="eq-mode-choices__row correction-quick-pick">
      <span className="eq-mode-choices__label">
        {t('myCurves.quick.label')}
      </span>
      <div className="correction-quick-pick__field">
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('myCurves.quick.previous')}
          title={t('myCurves.quick.previous')}
          disabled={isOff}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <RichPick
          className="correction-quick-pick__pick"
          entries={entries}
          groupLabel={(group) =>
            group === GROUP_MINE
              ? t('myCurves.tab.mine')
              : t('myCurves.quick.opra', {
                  name: product ? opraProductLabel(product) : '',
                })
          }
          activeId={activeId}
          onPick={(id) => {
            play(id).catch(() => undefined);
          }}
          placeholder={t('myCurves.quick.none')}
          placeholderIcon={<Glyph />}
          triggerAriaLabel={t('myCurves.quick.label')}
          triggerTitle={t('myCurves.quick.label')}
          disabled={isOff}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('myCurves.quick.next')}
          title={t('myCurves.quick.next')}
          disabled={isOff}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
