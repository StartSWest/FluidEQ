/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
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
    useFluidEqContext();
  const { t } = useTranslation();
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

  const loadCatalog = useCallback(
    async (search: string) => {
      setIsLoading(true);
      try {
        setEntries(await getConvolutionCatalog(search));
        if (ownsGlobalError.current) {
          ownsGlobalError.current = false;
          setGlobalError(undefined);
        }
      } catch (error) {
        ownsGlobalError.current = true;
        setGlobalError(error as ErrorDescription);
      } finally {
        setIsLoading(false);
      }
    },
    [setGlobalError],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim()) {
        addConvolutionSearchToHistory(query);
      }
      loadCatalog(query).catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [loadCatalog, query]);

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
          <p className="eyebrow">{t('convolution.eyebrow')}</p>
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
              <input
                id="convolution-model-search"
                type="search"
                aria-labelledby="convolution-model-search-label"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder={t('convolution.searchPlaceholder')}
                autoComplete="off"
              />
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
          <div className="convolution-notice">{t('convolution.notice')}</div>
          <div className="convolution-results" aria-live="polite">
            {isLoading && (
              <div className="convolution-empty">
                {t('convolution.loading')}
              </div>
            )}
            {!isLoading && entries.length === 0 && (
              <div className="convolution-empty">{t('convolution.empty')}</div>
            )}
            {!isLoading &&
              entries.map((entry) => {
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
