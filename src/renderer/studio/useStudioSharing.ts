import { useCallback, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { resolveSceneName } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import { useTranslation } from '../utils/I18nContext';
import {
  exportStudioScene,
  importMemberScene,
  studioTermsAgreed,
} from './studioStore';

export interface ISharingNotice {
  ok: boolean;
  key: TranslationKey;
  vars?: Record<string, string>;
}

const EXPORT_FAILURES: Record<string, TranslationKey> = {
  // This app always sends the terms version it carries, so the server asking
  // for a newer one means the app is older than the terms: showing the same
  // text again would ask forever.
  terms: 'studio.export.outdated',
  offline: 'studio.export.offline',
  banned: 'studio.export.banned',
  'rate-limited': 'studio.export.rateLimited',
  refused: 'studio.export.refused',
  'signed-out': 'studio.export.signedOut',
  'no-build': 'studio.export.refused',
  'official-copy': 'studio.export.officialCopy',
  'inspect-only': 'studio.inspect.locked',
  server: 'studio.export.failed',
};

const IMPORT_FAILURES: Record<string, TranslationKey> = {
  unreadable: 'studio.import.unreadable',
  changed: 'studio.import.changed',
  blocked: 'studio.import.blocked',
};

/**
 * Export and "Open a scene file", with everything they can say back.
 *
 * Export asks for the terms first only when the signed-in account has not
 * shared, on this computer, under the version this app carries — another
 * account's agreement here does not count. A refusal because the account has no
 * Plus opens the Plus card, which is where that answer can be acted on.
 */
export default function useStudioSharing() {
  const { locale } = useTranslation();
  const [notice, setNotice] = useState<ISharingNotice>();
  const [askTerms, setAskTerms] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runExport = useCallback(async () => {
    setExporting(true);
    setNotice(undefined);
    const outcome = await exportStudioScene(PLUS_TERMS_VERSION);
    setExporting(false);
    if (outcome.ok) {
      setAskTerms(false);
      setNotice({
        ok: true,
        key: 'studio.notice.exported',
        vars: { file: outcome.fileName },
      });
      return;
    }
    setAskTerms(false);
    if (outcome.reason === 'cancelled') {
      return;
    }
    if (outcome.reason === 'not-entitled') {
      requestAccountPanel('subscribe');
      return;
    }
    setNotice({
      ok: false,
      key: EXPORT_FAILURES[outcome.reason] ?? 'studio.export.failed',
    });
  }, []);

  const startExport = useCallback(async () => {
    if ((await studioTermsAgreed()) >= PLUS_TERMS_VERSION) {
      await runExport();
    } else {
      setAskTerms(true);
    }
  }, [runExport]);

  const openFile = useCallback(async () => {
    setNotice(undefined);
    const outcome = await importMemberScene();
    if (outcome.ok) {
      const name = resolveSceneName(outcome, locale);
      if (outcome.own) {
        setNotice({
          ok: true,
          key: outcome.restored
            ? 'studio.import.ownRestored'
            : 'studio.import.own',
          vars: { name },
        });
      } else if (outcome.authorName) {
        setNotice({
          ok: true,
          key: 'studio.import.done',
          vars: { name, author: outcome.authorName },
        });
      } else {
        setNotice({
          ok: true,
          key: 'studio.import.doneAnonymous',
          vars: { name },
        });
      }
      return;
    }
    if (outcome.reason === 'cancelled') {
      return;
    }
    if (outcome.reason === 'not-entitled') {
      requestAccountPanel('subscribe');
      return;
    }
    setNotice({ ok: false, key: IMPORT_FAILURES[outcome.reason] });
  }, [locale]);

  return {
    notice,
    askTerms,
    exporting,
    startExport: () => {
      startExport().catch(() =>
        setNotice({ ok: false, key: 'studio.export.failed' }),
      );
    },
    agreeAndExport: () => {
      runExport().catch(() =>
        setNotice({ ok: false, key: 'studio.export.failed' }),
      );
    },
    cancelTerms: () => setAskTerms(false),
    openFile: () => {
      openFile().catch(() =>
        setNotice({ ok: false, key: 'studio.import.unreadable' }),
      );
    },
  };
}
