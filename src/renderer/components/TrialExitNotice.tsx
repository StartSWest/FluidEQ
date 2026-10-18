/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { ITrialExitStatus } from 'common/trialExit';
import MenuIcon from '../icons/MenuIcon';
import { useAccount } from '../account/accountStore';
import TrialExitDialog from '../plus/TrialExitDialog';
import { usePlusTrial } from '../plus/trialStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/SceneReviewNotice.scss';

const bridge = () => window.electron?.ipcRenderer;

/** What this computer already did with the question, per account. */
type TSettled = 'later' | 'sent';

const settledKey = (accountId: string) => `fluideq.trialExit.${accountId}`;

const readSettled = (accountId: string): TSettled | undefined => {
  try {
    const value = localStorage.getItem(settledKey(accountId));
    return value === 'later' || value === 'sent' ? value : undefined;
  } catch {
    return undefined;
  }
};

const writeSettled = (accountId: string, value: TSettled) => {
  try {
    localStorage.setItem(settledKey(accountId), value);
  } catch {
    // Without storage the question may come back next launch; the server
    // still keeps one answer, so the harm is only being asked again.
  }
};

/**
 * Once a member's free trial has ended without Plus, one question in the
 * corner: what kept them from it (premium migration 0054). Ivan, 2026-10-16:
 * "we need to collect a reason why they didn't join Plus".
 *
 * Asked once. "Not now" is an answer too, and this computer keeps it; an
 * answer sent is the server's, which also stops it being asked anywhere
 * else. The server decides who is asked: a member who paid after the trial,
 * or who never had one, is not.
 */
export default function TrialExitNotice() {
  const { t } = useTranslation();
  const { identity, status } = useAccount();
  const accountId = status === 'signed-in' ? identity?.id : undefined;
  const { offer, owner } = usePlusTrial();
  const ended = offer?.state === 'ended' && owner === accountId;
  // The server's answer for this account, kept with the account it was for.
  const [asked, setAsked] = useState<{
    id: string;
    status: ITrialExitStatus;
  }>();
  const [settled, setSettled] = useState<{ id: string; value: TSettled }>();
  const [stage, setStage] = useState<'ask' | 'dialog' | 'thanks'>('ask');

  useEffect(() => {
    if (!accountId || !ended || readSettled(accountId)) {
      return undefined;
    }
    let current = true;
    bridge()
      ?.getTrialExit?.()
      .then((outcome) => {
        if (current && outcome.ok) {
          setAsked({ id: accountId, status: outcome.status });
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [accountId, ended]);

  const open =
    accountId !== undefined &&
    ended &&
    asked?.id === accountId &&
    asked.status.asked &&
    asked.status.reason === undefined &&
    settled?.id !== accountId &&
    readSettled(accountId) === undefined;
  const thanking = stage === 'thanks' && settled?.id === accountId;
  const wants = (open && stage === 'ask') || thanking;
  // After the maker's month and before an announcement: a question of their
  // own trial is about this member, an announcement is news for everybody.
  const isShown = useNoticeTurn('trialExit', wants);

  if (!accountId) {
    return null;
  }
  const settle = (value: TSettled) => {
    writeSettled(accountId, value);
    setSettled({ id: accountId, value });
  };

  if (stage === 'dialog' && open) {
    return (
      <TrialExitDialog
        onClose={(sent) => {
          settle(sent ? 'sent' : 'later');
          setStage(sent ? 'thanks' : 'ask');
        }}
      />
    );
  }
  if (!isShown) {
    return null;
  }
  if (thanking) {
    return (
      <CompactFrame
        className="scene-review-notice trial-exit-notice"
        icon={<MenuIcon name="plusTab" />}
        title={t('trialExit.thanks.title')}
        titleId="trial-exit-notice-title"
        role="dialog"
        // Never the frame's default `aria-modal="true"`: the corner gives way
        // to any modal, so a thank-you that counted as one hid itself, came
        // back when it was gone, and hid itself again — for ever, freezing
        // the window the moment an answer was sent.
        aria-modal="false"
        onClose={() => setStage('ask')}
        closeLabel={t('app.dismiss')}
      >
        <p className="scene-review-notice__line">
          {t('trialExit.thanks.body')}
        </p>
      </CompactFrame>
    );
  }
  return (
    <CompactFrame
      className="scene-review-notice trial-exit-notice"
      icon={<MenuIcon name="plusTab" />}
      title={t('trialExit.notice.title')}
      titleId="trial-exit-notice-title"
      role="dialog"
      aria-modal="false"
      onClose={() => settle('later')}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={() => settle('later')}
          >
            {t('trialExit.later')}
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => setStage('dialog')}
          >
            {t('trialExit.notice.open')}
          </button>
        </>
      }
    >
      <p className="scene-review-notice__line">{t('trialExit.notice.body')}</p>
    </CompactFrame>
  );
}
