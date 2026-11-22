/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ErrorDescription } from '../../../../common/errors';
import { findPresetShareCode } from '../../../../common/presetShare/presetShareCode';
import { findSharedPresetId } from '../../../../common/presetShare/sharedPresetLink';
import DialogFrame from '../../../components/DialogFrame';
import PasteButton from '../../../components/PasteButton';
import MenuIcon from '../../../icons/MenuIcon';
import { useFluidEqLayers } from '../../../utils/FluidEqContext';
import { useTranslation } from '../../../utils/I18nContext';
import PresetShareCard from './PresetShareCard';
import useAddSharedPreset from './useAddSharedPreset';
import useSharedPreset, { type TSharedPresetRead } from './useSharedPreset';

interface ISharedPresetImportDialogProps {
  /**
   * `paste`: Yours' Import, a box for anything. `link`: a link opened from
   * fluideq.com, which brings its code and only asks.
   */
  mode: 'paste' | 'link';
  initialText?: string;
  onClose: () => void;
}

const PROBLEM_KEY = {
  missing: 'presetShare.import.missing',
  newer: 'presetShare.import.newer',
  damaged: 'presetShare.import.damaged',
  gone: 'presetShare.import.gone',
  offline: 'presetShare.import.offline',
} as const;

const problemOf = (read: TSharedPresetRead | undefined) =>
  read && !read.ok && read.problem !== 'reading'
    ? PROBLEM_KEY[read.problem]
    : undefined;

/**
 * Bringing a shared preset in: paste a forum post, a message, a link or a
 * preset file, and FluidEQ finds the preset inside and shows it before it
 * keeps anything (Ivan, 2026-11-20: "FluidEQ can import back from the
 * clipboard or a link").
 *
 * The clipboard is read only on the press of its button, never on its own:
 * a window that read the clipboard whenever it came forward would be reading
 * whatever the listener copied elsewhere. A link's question shows the preset
 * and the two answers; nothing is saved or played until Add.
 */
const SharedPresetImportDialog = ({
  mode,
  initialText = '',
  onClose,
}: ISharedPresetImportDialogProps) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqLayers();
  const titleId = useId();
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  // A short link pasted here, or the one a page opened, is followed: main
  // fetches its preset from FluidEQ's server by id.
  const read = useSharedPreset(text, true);
  const add = useAddSharedPreset();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const readFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setNote('');
    file
      .text()
      .then((contents) => {
        setText(contents);
        return contents;
      })
      .catch(() => setNote(t('dsp.eqPreset.importFailed')));
  };

  const found = read?.ok ? read.preset : undefined;
  const source = read?.ok ? read.source : undefined;
  const problem = problemOf(read);
  // A short link with no code beside it is a request to FluidEQ's server:
  // said from its first moment, in the link's question or in the box. A code
  // reads in an instant and needs no line.
  const isFetching =
    read?.ok === false &&
    read.problem === 'reading' &&
    findSharedPresetId(text) !== undefined &&
    findPresetShareCode(text) === undefined;
  let byline: string | undefined;
  if (source) {
    byline = source.author
      ? t('presetShare.card.sharedBy', { author: source.author })
      : t('presetShare.card.sharedByMember');
  }

  const keep = () => {
    if (!found || adding) {
      return;
    }
    setAdding(true);
    add(found)
      .then(() => {
        onClose();
        return true;
      })
      .catch((error: unknown) => {
        setAdding(false);
        setGlobalError(error as ErrorDescription);
      });
  };

  const isLink = mode === 'link';

  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogFrame
        className={`dsp-import-dialog preset-share-dialog${
          isLink ? ' is-question' : ''
        }`}
        // Into the list, the arrow down into the tray; Share and Export
        // wear it going out (`upload`), so the two never look alike here.
        icon={<MenuIcon name="download" />}
        title={t(
          isLink ? 'presetShare.link.title' : 'presetShare.import.title',
        )}
        titleId={titleId}
        description={t(
          isLink ? 'presetShare.link.hint' : 'presetShare.import.hint',
        )}
        onClose={onClose}
        closeLabel={t('support.close')}
        footer={
          <>
            {!isLink && (
              <button
                type="button"
                className="button small subtle"
                onClick={() => fileRef.current?.click()}
              >
                {t('presetShare.import.chooseFile')}
              </button>
            )}
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                onClick={onClose}
              >
                {t(isLink ? 'presetShare.link.notNow' : 'dsp.eqImport.cancel')}
              </button>
              <button
                type="button"
                className={`button small${adding ? ' is-running' : ''}`}
                disabled={!found || adding}
                onClick={keep}
              >
                {t('presetShare.card.add')}
              </button>
            </div>
          </>
        }
      >
        {!isLink && (
          <div className="preset-share-dialog__paste">
            <PasteButton target={textRef} />
            <textarea
              ref={textRef}
              className="preset-share-dialog__text"
              value={text}
              spellCheck={false}
              placeholder={t('presetShare.import.placeholder')}
              aria-label={t('presetShare.import.placeholder')}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        )}

        {found && (
          <div className="preset-share-dialog__found">
            {!isLink && (
              <p className="preset-share-dialog__found-label">
                <MenuIcon name="check" />
                {t('presetShare.import.found')}
              </p>
            )}
            <PresetShareCard
              name={found.name}
              settings={found.settings}
              curve={found.curve}
              byline={byline}
            />
          </div>
        )}

        {isFetching && (
          <p className="preset-share-dialog__fetching" role="status">
            {t('presetShare.link.fetching')}
          </p>
        )}

        {(problem || note) && (
          <p className="dsp-import__error" role="status">
            {note || (problem && t(problem))}
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={(event) => {
            readFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </DialogFrame>
    </div>,
    document.body,
  );
};

export default SharedPresetImportDialog;
