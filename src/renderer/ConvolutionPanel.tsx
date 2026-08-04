/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import { useAquaContext } from './utils/AquaContext';
import {
  clearConvolution,
  downloadConvolution,
  getConvolutionCatalog,
} from './utils/equalizerApi';
import './styles/Convolution.scss';

const ConvolutionPanel = () => {
  const { convolution, isEnabled, refreshState, setGlobalError } =
    useAquaContext();
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<IConvolutionCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string>();
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

  return (
    <section className="convolution-panel" aria-labelledby="convolution-title">
      <div className="convolution-panel__intro">
        <div>
          <p className="eyebrow">APO impulse responses</p>
          <h2 id="convolution-title">Convolution library</h2>
          <p>
            Download a verified, minimum-phase headphone impulse and apply it
            before your parametric EQ. The shared response graph below keeps
            both curves visible.
          </p>
          <a
            className="convolution-source-link"
            href={selectedSource.website}
            target="_blank"
            rel="noreferrer"
          >
            {selectedSource.name}
          </a>
        </div>
        {convolution && (
          <button
            type="button"
            className="convolution-button convolution-button--quiet"
            disabled={!isEnabled}
            onClick={handleClear}
          >
            Clear convolution
          </button>
        )}
      </div>

      {selectedSource.downloadable ? (
        <>
          <div className="convolution-search">
            <span id="convolution-model-search-label">
              Search headphone models
            </span>
            <input
              id="convolution-model-search"
              type="search"
              aria-labelledby="convolution-model-search-label"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “Kraken”, “HD 650”, or a measurement provider"
              autoComplete="off"
            />
          </div>
          <div className="convolution-notice">
            AutoEq provides the downloadable catalogue. Files are imported as 48
            kHz WAV because Equalizer APO requires the impulse response to match
            the active output sample rate.
          </div>
          <div className="convolution-results" aria-live="polite">
            {isLoading && (
              <div className="convolution-empty">
                Loading official catalogue…
              </div>
            )}
            {!isLoading && entries.length === 0 && (
              <div className="convolution-empty">
                No matching impulse responses. Try a shorter model name.
              </div>
            )}
            {!isLoading &&
              entries.map((entry) => {
                const isApplied = convolution?.sourceUrl === entry.sourceUrl;
                const isDownloading = downloadingId === entry.id;
                let actionLabel = 'Download & apply';
                if (isDownloading) {
                  actionLabel = 'Downloading…';
                } else if (isApplied) {
                  actionLabel = 'Applied';
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
                      Source
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

      <div className="convolution-active" aria-live="polite">
        <span className={`status-dot${convolution ? '' : ' is-muted'}`} />
        {convolution ? (
          <span>
            Active convolution: <strong>{convolution.name}</strong>
          </span>
        ) : (
          <span>
            No convolution loaded. The EQ tab remains fully independent.
          </span>
        )}
      </div>
    </section>
  );
};

export default ConvolutionPanel;
