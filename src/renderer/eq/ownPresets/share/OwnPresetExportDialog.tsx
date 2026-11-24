/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { toDspChainPresetFile } from '../../../../common/dsp/dspChainPresetFile';
import { encodePresetShareCode } from '../../../../common/presetShare/presetShareCode';
import type { TSharePresetLinkRefusal } from '../../../../common/presetShare/sharedPresetLink';
import { requestAccountPanel } from '../../../account/accountPanel';
import { useAccount, useAccountKnown } from '../../../account/accountStore';
import DialogFrame from '../../../components/DialogFrame';
import type { IDspCatalogEntry } from '../../../dsp/dspPresetCatalog';
import MenuIcon from '../../../icons/MenuIcon';
import { exportDspChainPreset } from '../../../utils/equalizerApi';
import { useTranslation } from '../../../utils/I18nContext';
import presetApoText from './presetApoText';
import PresetShareCard from './PresetShareCard';
import {
  DISCORD_MESSAGE_MAX,
  presetShareText,
  rackStageNames,
  type TShareFormat,
} from './presetShareText';
import PRESET_LINKS_OPEN from './presetLinksRelease';
import usePresetShortLink from './usePresetShortLink';

/** Why the export's short link was not made, as the box under it says. */
const LINK_REFUSAL = {
  'signed-out': 'presetShare.linkFailed.signedOut',
  suspended: 'presetShare.linkFailed.suspended',
  'rate-limited': 'presetShare.linkFailed.rateLimited',
  'too-many': 'presetShare.linkFailed.tooMany',
  'taken-down': 'presetShare.linkFailed.takenDown',
  invalid: 'presetShare.linkFailed.offline',
  offline: 'presetShare.linkFailed.offline',
} as const satisfies Record<TSharePresetLinkRefusal, string>;

type TExportTab = 'forum' | 'file' | 'apo';

// Keys written out, so `i18nKeysInUse` sees each one read.
const TABS = {
  forum: 'presetShare.export.tab.forum',
  file: 'presetShare.export.tab.file',
  apo: 'presetShare.export.tab.apo',
} as const satisfies Record<TExportTab, string>;
const FORMATS = {
  markdown: ['presetShare.format.markdown', 'presetShare.format.markdownFor'],
  bbcode: ['presetShare.format.bbcode', 'presetShare.format.bbcodeFor'],
  plain: ['presetShare.format.plain', 'presetShare.format.plainFor'],
} as const satisfies Record<TShareFormat, readonly [string, string]>;

interface IOwnPresetExportDialogProps {
  preset: IDspCatalogEntry;
  onClose: () => void;
}

/**
 * A preset of the listener's own, out of FluidEQ (Ivan, 2026-11-20:
 * "export the users presets … but also to export to any forums"): as text
 * for any forum — Markdown, BBCode or plain, with its code and, for an
 * account, the short link to its page on fluideq.com — as the preset file
 * the DSP page already writes, or as the curve alone in Equalizer APO's text
 * for somebody on another equaliser.
 *
 * The link is on by default for an account, because a link is what brings
 * somebody without FluidEQ to it (Ivan, 2026-11-20). Signed out, the box
 * gives way to a quiet Sign in that opens the Account panel; the code alone
 * is still the whole preset.
 *
 * What the action does is said by its label and shown by the box above it;
 * nothing leaves the window but by the listener's press: Copy, or Save in
 * the system's own Save dialog.
 */
const OwnPresetExportDialog = ({
  preset,
  onClose,
}: IOwnPresetExportDialogProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const linkId = useId();
  const [tab, setTab] = useState<TExportTab>('forum');
  const [format, setFormat] = useState<TShareFormat>('markdown');
  const [withLink, setWithLink] = useState(true);
  const [code, setCode] = useState<string | undefined>(undefined);
  const isSignedIn = useAccount().identity !== undefined;
  const isAccountKnown = useAccountKnown();
  const link = usePresetShortLink(
    preset,
    code,
    PRESET_LINKS_OPEN && isSignedIn && withLink && tab === 'forum',
  );
  const [done, setDone] = useState<TExportTab | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    encodePresetShareCode(preset.name, preset.settings, preset.curve)
      .then((next) => {
        if (current) {
          setCode(next);
        }
        return next;
      })
      .catch(() => {
        if (current) {
          setFailed(true);
        }
      });
    return () => {
      current = false;
    };
  }, [preset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const forumText = code
    ? presetShareText(
        {
          ...preset,
          code,
          ...(link.state === 'ready' ? { link: link.url } : {}),
        },
        format,
        t,
      )
    : '';
  const apoText = presetApoText(preset.curve);
  const stages = rackStageNames(preset.settings, t);
  const fits = forumText.length <= DISCORD_MESSAGE_MAX;

  const copy = (text: string) => {
    setFailed(false);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setDone(tab);
        return true;
      })
      .catch(() => setFailed(true));
  };

  const save = () => {
    setFailed(false);
    exportDspChainPreset(
      preset.name,
      toDspChainPresetFile(preset.name, preset.settings, preset.curve),
    )
      .then((saved) => {
        if (saved) {
          setDone('file');
        }
        return saved;
      })
      .catch(() => setFailed(true));
  };

  let action: {
    label: string;
    icon: 'copyText' | 'download';
    run?: () => void;
  };
  if (tab === 'file') {
    action = {
      label: t('presetShare.export.save'),
      icon: 'download',
      run: save,
    };
  } else if (tab === 'apo') {
    action = {
      label: t('presetShare.export.copyCurve'),
      icon: 'copyText',
      run: apoText ? () => copy(apoText) : undefined,
    };
  } else {
    action = {
      label: t('presetShare.export.copy'),
      icon: 'copyText',
      run: forumText ? () => copy(forumText) : undefined,
    };
  }
  const isDone = done === tab;

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
        className="dsp-import-dialog preset-share-dialog"
        icon={<MenuIcon name="upload" />}
        title={t('presetShare.export.title', { name: preset.name })}
        titleId={titleId}
        description={t('presetShare.export.hint')}
        onClose={onClose}
        closeLabel={t('support.close')}
        footer={
          <>
            {failed && (
              <span className="dsp-import__error" role="status">
                {t('presetShare.export.failed')}
              </span>
            )}
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                onClick={onClose}
              >
                {t('support.close')}
              </button>
              <button
                type="button"
                className="button small"
                disabled={!action.run}
                onClick={action.run}
              >
                <MenuIcon name={isDone ? 'check' : action.icon} />
                {isDone
                  ? t(
                      tab === 'file'
                        ? 'presetShare.export.saved'
                        : 'presetShare.export.copied',
                    )
                  : action.label}
              </button>
            </div>
          </>
        }
      >
        <div className="segmented preset-share-dialog__tabs" role="tablist">
          {(Object.keys(TABS) as TExportTab[]).map((one) => (
            <button
              key={one}
              type="button"
              role="tab"
              aria-selected={tab === one}
              className={`segmented__option${tab === one ? ' is-selected' : ''}`}
              onClick={() => {
                setTab(one);
                setFailed(false);
              }}
            >
              {t(TABS[one])}
            </button>
          ))}
        </div>

        {tab === 'forum' && (
          <div className="preset-share-dialog__pane">
            <div className="preset-share-dialog__formats" role="group">
              {(Object.keys(FORMATS) as TShareFormat[]).map((one) => (
                <button
                  key={one}
                  type="button"
                  className={`preset-share-dialog__format${
                    format === one ? ' is-selected' : ''
                  }`}
                  aria-pressed={format === one}
                  onClick={() => {
                    setFormat(one);
                    setDone(undefined);
                  }}
                >
                  <strong>{t(FORMATS[one][0])}</strong>
                  <span>{t(FORMATS[one][1])}</span>
                </button>
              ))}
            </div>
            <pre className="preset-share-dialog__text" aria-live="polite">
              {forumText}
            </pre>
            {PRESET_LINKS_OPEN && isSignedIn && (
              <label className="preset-share-dialog__check" htmlFor={linkId}>
                <input
                  id={linkId}
                  type="checkbox"
                  checked={withLink}
                  onChange={(event) => {
                    setWithLink(event.target.checked);
                    setDone(undefined);
                  }}
                />
                {t('presetShare.export.withLink')}
                {link.state === 'making' && (
                  <span className="preset-share-dialog__link-note">
                    {t('presetShare.linkMaking')}
                  </span>
                )}
                {link.state === 'refused' && (
                  <span
                    className="preset-share-dialog__link-note is-problem"
                    role="status"
                  >
                    {t(LINK_REFUSAL[link.reason])}
                  </span>
                )}
              </label>
            )}
            {PRESET_LINKS_OPEN && !isSignedIn && isAccountKnown && (
              <button
                type="button"
                className="button small subtle preset-share-dialog__sign-in"
                onClick={() => requestAccountPanel('home')}
              >
                {t('presetShare.export.linkSignIn')}
              </button>
            )}
            <p className="preset-share-dialog__meta">
              <span className={fits ? 'is-fit' : 'is-long'}>
                {t(
                  fits ? 'presetShare.export.fits' : 'presetShare.export.long',
                  {
                    count: forumText.length,
                  },
                )}
              </span>
            </p>
          </div>
        )}

        {tab === 'file' && (
          <div className="preset-share-dialog__pane">
            <PresetShareCard
              name={preset.name}
              settings={preset.settings}
              curve={preset.curve}
              // The name main's Save dialog proposes (`ipc/transfer.ts`).
              byline={`${
                preset.name.replace(/[^\w\- ]+/g, '').trim() || 'Custom'
              }.fluideq-dsp.json`}
            />
            <p className="preset-share-dialog__meta">
              {t('presetShare.export.fileHint')}
            </p>
          </div>
        )}

        {tab === 'apo' && (
          <div className="preset-share-dialog__pane">
            {apoText ? (
              <pre className="preset-share-dialog__text">{apoText}</pre>
            ) : (
              <p className="dsp-import__warning">
                {t('presetShare.export.apoNoCurve')}
              </p>
            )}
            {apoText && stages.length > 0 && (
              <p className="dsp-import__warning">
                {t('presetShare.export.apoRack', { stages: stages.join(', ') })}
              </p>
            )}
          </div>
        )}
      </DialogFrame>
    </div>,
    document.body,
  );
};

export default OwnPresetExportDialog;
