/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONVOLUTION_SOURCES,
  IConvolutionCatalogEntry,
} from 'common/convolution';
import { ErrorDescription } from 'common/errors';
import { suggestSearches } from 'common/searchHistory';
import { useFluidEqLayers } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { useCurrentEngine } from './utils/audioEngineContext';
import {
  clearConvolution,
  downloadConvolution,
  getConvolutionCatalog,
  importConvolutionFile,
} from './utils/equalizerApi';
import MenuIcon from './icons/MenuIcon';
import {
  addConvolutionSearchToHistory,
  clearConvolutionSearchHistory,
  useConvolutionSearchHistory,
} from './utils/convolutionSearchHistory';
import './styles/Convolution.scss';

const ConvolutionPanel = () => {
  const { convolution, isEnabled, refreshState, setGlobalError } =
    useFluidEqLayers();
  const { t } = useTranslation();
  const isFluid = useCurrentEngine() === 'fluid';
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchHistory = useConvolutionSearchHistory();
  const searchSuggestions = suggestSearches(searchHistory, query);
  const [entries, setEntries] = useState<IConvolutionCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [isImporting, setIsImporting] = useState(false);
  const selectedSource = useMemo(() => CONVOLUTION_SOURCES[0], []);

  // A successful catalogue load must only clear an error this panel raised.
  // Clearing unconditionally also dismissed unrelated failures such as
  // "Equalizer APO is not installed", hiding the prerequisite modal.
  const ownsGlobalError = useRef(false);
  /**
   * Which request is the newest; only its answer is drawn.
   *
   * Every change of the query asks at once. A 220 ms timer stood in front of
   * each ask instead — the first one included, so every visit to this page
   * showed "Loading" for that long before anything was asked — and it still
   * let an older answer that came back late replace a newer one. Main filters
   * a catalogue it holds in memory, so an answer per keystroke costs nothing
   * worth waiting for; what matters is that only the last one lands.
   */
  const latestRequest = useRef(0);

  const loadCatalog = useCallback(
    async (search: string) => {
      latestRequest.current += 1;
      const request = latestRequest.current;
      setIsLoading(true);
      try {
        const found = await getConvolutionCatalog(search);
        if (request !== latestRequest.current) {
          return;
        }
        setEntries(found);
        if (ownsGlobalError.current) {
          ownsGlobalError.current = false;
          setGlobalError(undefined);
        }
      } catch (error) {
        if (request !== latestRequest.current) {
          return;
        }
        ownsGlobalError.current = true;
        setGlobalError(error as ErrorDescription);
      } finally {
        if (request === latestRequest.current) {
          setIsLoading(false);
        }
      }
    },
    [setGlobalError],
  );

  useEffect(() => {
    loadCatalog(query).catch(() => undefined);
  }, [loadCatalog, query]);

  // Dropped on the way out, so an answer for this page cannot land on a page
  // that is no longer there.
  useEffect(
    () => () => {
      latestRequest.current += 1;
    },
    [],
  );

  /**
   * A search goes into the history when it is finished with — Enter, leaving
   * the field, or a recent one picked — rather than when typing pauses. The
   * pause was a timer, and every pause in the middle of a name went into the
   * history as a search of its own.
   */
  const rememberQuery = (search: string) => {
    if (search.trim()) {
      addConvolutionSearchToHistory(search);
    }
  };

  const handleApply = async (entry: IConvolutionCatalogEntry) => {
    setDownloadingId(entry.id);
    try {
      await downloadConvolution(entry.id);
      await refreshState();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setDownloadingId(undefined);
    }
  };

  const handleClear = async () => {
    try {
      await clearConvolution();
      await refreshState();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      // An empty summary means the picker was cancelled, which is not an event
      // worth reacting to.
      if (await importConvolutionFile()) {
        await refreshState();
      }
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="convolution-panel" aria-labelledby="convolution-title">
      <div className="convolution-panel__intro">
        <div>
          <p className="eyebrow">
            {t(isFluid ? 'convolution.eyebrow.fluid' : 'convolution.eyebrow')}
          </p>
          <h2 id="convolution-title">{t('convolution.title')}</h2>
          <p>{t('convolution.intro')}</p>
          <a
            className="convolution-source-link"
            href={selectedSource.website}
            target="_blank"
            rel="noreferrer"
          >
            {selectedSource.name}
          </a>
        </div>
        {/* Bringing your own impulse response is a first-class way to use this
            panel, not a fallback for when the catalogue search fails. */}
        <button
          type="button"
          className="convolution-button convolution-button--quiet"
          disabled={!isEnabled || isImporting}
          onClick={handleImport}
        >
          <MenuIcon name="import" className="convolution-button__icon" />
          {isImporting ? t('convolution.importing') : t('convolution.import')}
        </button>
      </div>

      {/* What is applied, stated before the catalogue rather than after it.
          A bare "Clear convolution" button used to be the only sign anything
          was loaded, which told you there was something to clear without ever
          saying what. */}
      {convolution && (
        <div className="convolution-applied" aria-live="polite">
          <MenuIcon name="convolution" className="convolution-applied__icon" />
          <div>
            <span className="convolution-applied__label">
              {t('convolution.applied')}
            </span>
            <strong title={convolution.name}>{convolution.name}</strong>
          </div>
          <button
            type="button"
            className="convolution-button convolution-button--quiet"
            disabled={!isEnabled}
            onClick={handleClear}
          >
            <MenuIcon name="clear" className="convolution-button__icon" />
            {t('convolution.clear')}
          </button>
        </div>
      )}

      {selectedSource.downloadable ? (
        <>
          <div className="convolution-search">
            <span id="convolution-model-search-label">
              {t('convolution.search')}
            </span>
            <div className="convolution-search__field">
              {/* A text input with the app's own clear cross, not a search
                  input with the browser's: Chromium draws a grey blob in a
                  `type="search"` field that no stylesheet can reach, and
                  every other search in the app clears with this cross. */}
              <input
                id="convolution-model-search"
                type="text"
                aria-labelledby="convolution-model-search-label"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsSearchFocused(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    rememberQuery(query);
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  setIsSearchFocused(false);
                  rememberQuery(query);
                }}
                placeholder={t('convolution.searchPlaceholder')}
                autoComplete="off"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="menu-search__clear convolution-search__clear"
                  aria-label={t('common.clearSearch')}
                  title={t('common.clearSearch')}
                  // Keeps the caret in the field: pressing a button focuses
                  // it, and this one unmounts on the very next render.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setQuery('')}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              )}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div className="convolution-search__history">
                  <div className="convolution-search__history-head">
                    <span>{t('video.searchRecent')}</span>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        clearConvolutionSearchHistory();
                        setIsSearchFocused(false);
                      }}
                    >
                      {t('video.searchForgetAll')}
                    </button>
                  </div>
                  <div className="convolution-search__history-items">
                    {searchSuggestions.map((search) => (
                      <button
                        type="button"
                        key={search}
                        title={search}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setQuery(search);
                          rememberQuery(search);
                        }}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden>
                          <path d="M8 4v4l2.6 1.6" />
                          <circle cx="8" cy="8" r="5.6" />
                        </svg>
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* The 48 kHz reason is Equalizer APO's: it needs the impulse at
              the output's own rate. The FluidEQ Engine converts it itself. */}
          <div className="convolution-notice">
            {t(isFluid ? 'convolution.notice.fluid' : 'convolution.notice')}
          </div>
          {/* The rows in hand stay up while the next answer is on its way:
              answers come with every key now, and blanking the list to say
              "Loading" for each one flashed it on every key. "Loading" is
              for the wait before there is anything to show. */}
          <div className="convolution-results" aria-live="polite">
            {isLoading && entries.length === 0 && (
              <div className="convolution-empty">
                {t('convolution.loading')}
              </div>
            )}
            {!isLoading && entries.length === 0 && (
              <div className="convolution-empty">{t('convolution.empty')}</div>
            )}
            {entries.map((entry) => {
              const isApplied = convolution?.sourceUrl === entry.sourceUrl;
              const isDownloading = downloadingId === entry.id;
              let actionLabel = t('convolution.apply');
              if (isDownloading) {
                actionLabel = t('convolution.downloading');
              } else if (isApplied) {
                actionLabel = t('convolution.isApplied');
              }
              return (
                <article className="convolution-result" key={entry.id}>
                  <div className="convolution-result__details">
                    <strong>{entry.name}</strong>
                    <span>
                      {entry.provider} · {entry.phase} phase ·{' '}
                      {entry.sampleRate / 1000} kHz WAV
                    </span>
                  </div>
                  <a
                    className="convolution-result__link"
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('convolution.source')}
                  </a>
                  <button
                    type="button"
                    className={`convolution-button${isApplied ? ' is-applied' : ''}`}
                    disabled={!isEnabled || isDownloading || isApplied}
                    onClick={() => handleApply(entry)}
                  >
                    {actionLabel}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Only the empty state. What is applied is stated at the top now, and
          saying it twice made the panel look like it had two of them. */}
      {!convolution && (
        <div className="convolution-active" aria-live="polite">
          <span className="status-dot is-muted" />
          <span>{t('convolution.none')}</span>
        </div>
      )}
    </section>
  );
};

export default ConvolutionPanel;
