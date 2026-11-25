/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useRef, useState } from 'react';
import {
  VERSION_NOTE_LOCALES,
  type TVersionNoteLocale,
} from '../../../../common/sceneVersionNote';
import StudioPublishNote, {
  UPDATE_NOTE_WORDS,
} from '../../../studio/StudioPublishNote';
import StudioPublishVideo from '../../../studio/StudioPublishVideo';
import type { INoteLines, TNoteLines } from '../../../studio/publishNoteLines';
import type { TPublishVideoState } from '../../../studio/usePublishVideo';
import { useTranslation } from '../../../utils/I18nContext';
import useTourFrames from '../useTourFrames';

const nothing = () => undefined;
const SCENE = 'Northern Lake';

/** The line the scene's chat writes, made up, and its first words in each language. */
const LINE: Record<TVersionNoteLocale, string> = {
  en: 'The lake now mirrors the aurora, and the pines sway with the bass.',
  de: 'Der See spiegelt jetzt das Polarlicht, und die Kiefern wiegen sich im Bass.',
  es: 'El lago ahora refleja la aurora y los pinos se mecen con el bajo.',
  fr: 'Le lac reflète désormais l’aurore, et les pins dansent avec les basses.',
  hi: 'अब झील में ध्रुवीय ज्योति झलकती है, और चीड़ बेस के साथ झूमते हैं।',
  it: 'Il lago ora riflette l’aurora e i pini ondeggiano con i bassi.',
  ja: '湖がオーロラを映し、松がベースに合わせて揺れるようになりました。',
  ko: '호수에 오로라가 비치고, 소나무가 베이스에 맞춰 흔들립니다.',
  pt: 'O lago agora reflete a aurora, e os pinheiros balançam com o grave.',
  ru: 'Озеро теперь отражает сияние, а сосны качаются в такт басу.',
  zh: '湖面映出极光，松树随低音摇摆。',
  'zh-Hant': '湖面映出極光，松樹隨低音搖擺。',
};

const EMPTY = Object.fromEntries(
  VERSION_NOTE_LOCALES.map((locale) => [locale, '']),
) as TNoteLines;

/** Each step of the press, from its start, in seconds; then it begins again. */
const WRITING_AT = 1.5;
const WRITTEN_AT = 4;
const TRANSLATED_AT = 7;
const SENT_AT = 8.5;
const LOOP = 18;

interface IMoment {
  writing: boolean;
  typed: number;
  translating: number | undefined;
  translated: boolean;
  video: TPublishVideoState;
}

const momentAt = (seconds: number): IMoment => {
  const at = seconds % LOOP;
  const typed =
    at < WRITTEN_AT
      ? 0
      : Math.min(1, (at - WRITTEN_AT) / (TRANSLATED_AT - WRITTEN_AT - 1));
  let video: TPublishVideoState = { phase: 'idle' };
  if (at >= SENT_AT) {
    video = {
      phase: 'recording',
      elapsedMs: Math.min(10_000, (at - SENT_AT) * 1000 * 1.2),
    };
  }
  return {
    writing: at >= WRITING_AT && at < WRITTEN_AT,
    typed,
    translating:
      typed >= 1 && at < TRANSLATED_AT
        ? VERSION_NOTE_LOCALES.length - 1
        : undefined,
    translated: at >= TRANSLATED_AT,
    video,
  };
};

/**
 * Publishing an update from the Studio, as its dialog does it: the note's
 * box written by the scene's chat (Write with AI), the line translated into
 * every language the gallery speaks, and the preview recorded the moment
 * Send is pressed. The note and the preview are the dialog's own parts
 * (`StudioPublishNote`, `StudioPublishVideo`) on a made-up scene and line;
 * the dialog around them needs a real project, so its head and foot are its
 * markup. Nothing is sent, asked or recorded.
 */
export default function PublishLive() {
  const { t, locale } = useTranslation();
  const mine = (VERSION_NOTE_LOCALES as readonly string[]).includes(locale)
    ? (locale as TVersionNoteLocale)
    : 'en';
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [moment, setMoment] = useState<IMoment>(() => momentAt(0));
  useTourFrames((seconds) => setMoment(momentAt(seconds)), {
    fps: 10,
    still: TRANSLATED_AT + 0.5,
  });

  const lines: TNoteLines = { ...EMPTY };
  if (moment.translated) {
    VERSION_NOTE_LOCALES.forEach((one) => {
      lines[one] = LINE[one];
    });
  } else if (moment.typed > 0) {
    lines.en = LINE.en.slice(0, Math.round(LINE.en.length * moment.typed));
    lines[mine] = mine === 'en' ? lines.en : '';
  }
  const state: INoteLines = { base: lines, lines, edited: [] };

  return (
    <div className="tour-live26-publish">
      <div className="tour-live26-publish__head">
        <span className="dialog-frame__section-title">
          {t('studio.publish.version', { version: 12 })}
        </span>
        <strong>{t('studio.publish.titleUpdate', { name: SCENE })}</strong>
      </div>
      <StudioPublishNote
        words={UPDATE_NOTE_WORDS}
        state={state}
        setState={nothing}
        mine={mine}
        running={false}
        missing={false}
        onFilled={nothing}
        writing={moment.writing}
        translating={moment.translating}
        asWritten={false}
        unreadable={false}
        noteRef={noteRef}
        onWrite={nothing}
      />
      <StudioPublishVideo
        state={moment.video}
        away={false}
        locked={false}
        onCancel={nothing}
      />
      <div className="tour-live26-publish__foot">
        <span className="button small subtle">
          {t('studio.publish.cancel')}
        </span>
        <span className="button small">
          {t('studio.publish.goReviewUpdate')}
        </span>
      </div>
    </div>
  );
}
