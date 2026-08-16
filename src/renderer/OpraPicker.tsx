/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import {
  IOpraCurve,
  IOpraProduct,
  IOpraUpdateStatus,
  OPRA_SOURCE_ID,
} from 'common/constants';
import { useFluidEqContext } from './utils/FluidEqContext';
import MenuIcon from './icons/MenuIcon';
import { useTranslation } from './utils/I18nContext';
import {
  addOpraSearchToHistory,
  clearOpraSearchHistory,
  useOpraSearchHistory,
} from './utils/opraSearchHistory';
import SidebarSection from './components/SidebarSection';
import { formatPresetName } from './utils/utils';
import Button from './widgets/Button';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import opraLogo from '../../assets/opra-logo.png';
import './styles/AutoEQ.scss';
import {
  getOpraProductList,
  loadOpraPreset,
  checkOpraUpdate,
  clearHeadset,
  updateOpraDatabase,
} from './utils/equalizerApi';

const OPRA_URL = 'https://github.com/opra-project/OPRA';

/** `Sennheiser HD 650`, which is what the old library called a model. */
const productLabel = (product: IOpraProduct) =>
  `${product.vendor} ${product.name}`;

const OpraPicker = () => {
  const CLEAR_SELECTION_EVENT = 'fluideq-clear-autoeq-selection';
  const {
    headset,
    headsetTarget,
    headsetSource,
    isBlockingError,
    setGlobalError,
    refreshState,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const searchHistory = useOpraSearchHistory();
  const [products, setProducts] = useState<IOpraProduct[]>([]);
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentCurve, setCurrentCurve] = useState('');
  const [updateStatus, setUpdateStatus] = useState<IOpraUpdateStatus>();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const applyRunRef = useRef(0);
  const fetchRunRef = useRef(0);
  const appliedRef = useRef(headset);
  const appliedTargetRef = useRef(headsetTarget);
  const appliedSourceRef = useRef(headsetSource);

  useEffect(() => {
    appliedRef.current = headset;
    appliedTargetRef.current = headsetTarget;
    appliedSourceRef.current = headsetSource;
  }, [headset, headsetSource, headsetTarget]);

  useEffect(
    () => () => {
      applyRunRef.current += 1;
      fetchRunRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    const clearSelection = () => {
      setCurrentProduct('');
      setCurrentCurve('');
      refreshState();
    };
    window.addEventListener(CLEAR_SELECTION_EVENT, clearSelection);
    return () =>
      window.removeEventListener(CLEAR_SELECTION_EVENT, clearSelection);
  }, [CLEAR_SELECTION_EVENT, refreshState]);

  const fetchProducts = useCallback(async () => {
    fetchRunRef.current += 1;
    const runId = fetchRunRef.current;

    try {
      const entries = await getOpraProductList();
      if (fetchRunRef.current !== runId) {
        return;
      }
      setProducts(entries);

      // Restore whatever is applied, if it came from this library. A selection
      // saved before the switch carries the AutoEq source id and names a model
      // that no longer resolves — its bands are still applied and still audible,
      // there is simply no row here to light up for it.
      const appliedId = appliedRef.current;
      const appliedSource = appliedSourceRef.current;
      if (!appliedId || appliedSource !== OPRA_SOURCE_ID) {
        setCurrentProduct('');
        setCurrentCurve('');
        return;
      }
      const applied = entries.find((entry) => entry.id === appliedId);
      if (!applied) {
        setCurrentProduct('');
        setCurrentCurve('');
        return;
      }
      setCurrentProduct(applied.id);
      const appliedTarget = appliedTargetRef.current;
      setCurrentCurve(
        appliedTarget && applied.curves.some((c) => c.id === appliedTarget)
          ? appliedTarget
          : '',
      );
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  }, [setGlobalError]);

  useEffect(() => {
    checkOpraUpdate()
      .then(setUpdateStatus)
      .catch(() => setUpdateStatus(undefined))
      .finally(() => setIsCheckingUpdate(false));
  }, [fetchProducts]);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'databases-synced',
      (...args: unknown[]) => {
        const result = args[0] as { opra?: IOpraUpdateStatus } | undefined;
        if (result?.opra) {
          setUpdateStatus(result.opra);
          setIsCheckingUpdate(false);
        }
        fetchProducts();
      },
    );
    return () => {
      unsubscribe();
    };
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts, headset, headsetTarget, headsetSource]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === currentProduct),
    [products, currentProduct],
  );

  const handleProductChange = (newValue: string) => {
    const selected = products.find((product) => product.id === newValue);
    if (!selected) {
      return;
    }
    setCurrentProduct(newValue);
    // The curves travelled with the product, so there is nothing to wait for.
    setCurrentCurve(selected.curves[0]?.id ?? '');
  };

  const isApplied =
    !!headset &&
    !!selectedProduct &&
    selectedProduct.id === headset &&
    headsetSource === OPRA_SOURCE_ID &&
    currentCurve === headsetTarget;

  const selectedCurve: IOpraCurve | undefined = selectedProduct?.curves.find(
    (curve) => curve.id === currentCurve,
  );

  const applyOpra = async () => {
    applyRunRef.current += 1;
    const runId = applyRunRef.current;
    setIsApplying(true);
    try {
      if (!selectedProduct || !selectedCurve) {
        return;
      }
      const profileName = formatPresetName(
        `${productLabel(selectedProduct)} - ${selectedCurve.details}`,
      );
      await loadOpraPreset(selectedProduct.id, selectedCurve.id, profileName);
      window.dispatchEvent(new Event('fluideq-presets-changed'));
      await refreshState({ revealBands: true });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      if (applyRunRef.current === runId) {
        setIsApplying(false);
      }
    }
  };

  const updateDatabase = async () => {
    setIsUpdating(true);
    try {
      setUpdateStatus(await updateOpraDatabase());
      await fetchProducts();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  const curveOptions: IOptionEntry[] = useMemo(
    () =>
      (selectedProduct?.curves ?? []).map((curve) => ({
        value: curve.id,
        label: `${curve.details} · ${curve.author}`,
        display: (
          <div className="autoeq-response-option">
            <strong>{curve.details}</strong>
            <small>{t('opra.createdBy', { author: curve.author })}</small>
          </div>
        ),
      })),
    [selectedProduct, t],
  );

  const productOptions: IOptionEntry[] = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: productLabel(product),
        // Grouped by vendor, which is the one thing six thousand headphones
        // have that makes them navigable rather than a wall.
        group: product.vendor,
        /*
         * A thunk, not an element. The list mounts a page of rows at a time, so
         * building six thousand element trees up front costs far more than the
         * data behind them — which is exactly what `display` accepts a function
         * for, see IOptionEntry.
         *
         * The rule below reads any function returning JSX in a prop as a
         * component defined during render, whose type would change identity on
         * every pass and remount its subtree. This is not that: `List` calls it
         * through renderOptionDisplay to get nodes, and never treats it as a
         * component type, so there is no type for React to reconcile.
         */
        // eslint-disable-next-line react/no-unstable-nested-components
        display: () => (
          <div className="eq-device-option">
            <strong>{product.name}</strong>
            <small>
              {product.vendor} ·{' '}
              {t('opra.curveCount', { count: product.curves.length })}
            </small>
          </div>
        ),
      })),
    [products, t],
  );

  /** What is applied, in words, whichever library it came from. */
  const appliedLabel = useMemo(() => {
    if (!headset) {
      return undefined;
    }
    if (headsetSource !== OPRA_SOURCE_ID) {
      // Saved before the switch. The id is not ours to resolve, and it was a
      // readable model name back when it was written, so show it as it stands.
      return headsetTarget ? `${headset} · ${headsetTarget}` : headset;
    }
    const product = products.find((entry) => entry.id === headset);
    if (!product) {
      return headset;
    }
    const curve = product.curves.find((entry) => entry.id === headsetTarget);
    return curve
      ? `${productLabel(product)} · ${curve.details}`
      : productLabel(product);
  }, [headset, headsetSource, headsetTarget, products]);

  let applyLabel = t('autoeq.apply');
  if (isApplying) {
    applyLabel = t('autoeq.applying');
  } else if (isApplied) {
    applyLabel = t('convolution.isApplied');
  }

  return (
    <SidebarSection
      className="autoeq-section"
      eyebrow={t('autoeq.eyebrow')}
      title={t('autoeq.title')}
      summary={
        <div className="autoeq-applied">
          <MenuIcon name="model" />
          <span>
            {appliedLabel
              ? t('autoeq.applied', { name: appliedLabel })
              : t('autoeq.notApplied')}
          </span>
          {headset && (
            <button
              type="button"
              className="autoeq-applied__clear"
              title={t('eq.layers.clearReference')}
              aria-label={t('eq.layers.clearReference')}
              disabled={isBlockingError}
              onClick={(event) => {
                event.stopPropagation();
                clearHeadset()
                  .then(() => refreshState())
                  .catch((error) => setGlobalError(error as ErrorDescription));
              }}
            >
              <MenuIcon name="clear" />
            </button>
          )}
        </div>
      }
    >
      {/*
        Required, not decorative. OPRA's data is CC BY-SA 4.0 and the licence
        asks anything that browses the database to show the mark, say what the
        project is, and link to it. The per-curve credit under each target does
        the other half.
      */}
      <div className="opra-credit">
        <img src={opraLogo} alt="OPRA" className="opra-credit__logo" />
        <p>
          {t('opra.about')}{' '}
          <a href={OPRA_URL} target="_blank" rel="noreferrer">
            {t('opra.seeHere')}
          </a>
        </p>
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--model">
          <span className="autoeq-field__title">{t('autoeq.model')}</span>
          <Dropdown
            name={t('autoeq.deviceAria')}
            menuClassName="auto-eq-menu"
            options={productOptions}
            value={currentProduct}
            handleChange={handleProductChange}
            isDisabled={isBlockingError}
            noSelectionPlaceholder={t('autoeq.pickDevice')}
            emptyOptionsPlaceholder={t('autoeq.noModel')}
            filterPlaceholder={t('autoeq.searchModels')}
            searchHistory={searchHistory}
            searchHistoryLabel={t('video.searchRecent')}
            clearSearchHistoryLabel={t('video.searchForgetAll')}
            onSearchCommit={addOpraSearchToHistory}
            onClearSearchHistory={clearOpraSearchHistory}
            isFilterable
          />
        </div>
        <div className="autoeq-field autoeq-field--target">
          <span className="autoeq-field__title">{t('autoeq.target')}</span>
          <Dropdown
            name={t('autoeq.targetAria')}
            menuClassName="auto-eq-menu"
            options={curveOptions}
            value={currentCurve}
            handleChange={(newValue) => setCurrentCurve(newValue)}
            isDisabled={isBlockingError || curveOptions.length === 0}
            emptyOptionsPlaceholder={t('autoeq.noResponses')}
            noSelectionPlaceholder={t('autoeq.pickResponse')}
          />
        </div>
        <Button
          className={isApplied ? 'small is-applied' : 'small'}
          ariaLabel={t('autoeq.applyAria')}
          isDisabled={
            isBlockingError || currentProduct === '' || currentCurve === ''
          }
          handleChange={applyOpra}
        >
          {applyLabel}
        </Button>
      </div>
      {selectedCurve && (
        <p className="opra-curve-credit">
          {t('opra.createdBy', { author: selectedCurve.author })}
          {' · '}
          {t('opra.distributedBy')}
          {selectedCurve.link && (
            <>
              {' · '}
              <a href={selectedCurve.link} target="_blank" rel="noreferrer">
                {t('opra.source')}
              </a>
            </>
          )}
        </p>
      )}
      <div className="autoeq-update">
        <span>
          {isCheckingUpdate && t('autoeq.checking')}
          {!isCheckingUpdate &&
            updateStatus?.updateAvailable &&
            t('autoeq.updateAvailable', {
              count: updateStatus.latest?.productCount.toLocaleString() ?? '',
            })}
          {!isCheckingUpdate &&
            updateStatus &&
            !updateStatus.updateAvailable &&
            t('autoeq.upToDate', {
              count: updateStatus.current.productCount.toLocaleString(),
            })}
          {!isCheckingUpdate && !updateStatus && t('autoeq.updateUnknown')}
        </span>
        {updateStatus?.updateAvailable && (
          <Button
            className="small"
            ariaLabel={t('autoeq.updateAria')}
            isDisabled={isUpdating}
            handleChange={updateDatabase}
          >
            {isUpdating ? t('autoeq.updating') : t('autoeq.update')}
          </Button>
        )}
      </div>
    </SidebarSection>
  );
};

export default OpraPicker;
