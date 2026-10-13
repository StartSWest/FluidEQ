/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_TRIAL_WINDOW_MS,
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_SCENES,
  MAX_ANNOUNCEMENT_TITLE,
  trialEndsByDay,
  type IAdminAnnouncement,
  type IAnnouncementDraft,
  type TAnnouncementAudience,
} from 'common/sceneAnnouncements';
import { resolveSceneName } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { useUsableScenes } from '../utils/scenePacks';
import { ScenePicture } from './GalleryParts';
import { previewAnnouncement } from './sceneAnnouncementStore';

const AUDIENCES: Record<
  TAnnouncementAudience,
  { name: TranslationKey; line: TranslationKey }
> = {
  everyone: {
    name: 'announce.audience.everyone',
    line: 'announce.audience.everyoneLine',
  },
  members: {
    name: 'announce.audience.members',
    line: 'announce.audience.membersLine',
  },
  'trial-ending': {
    name: 'announce.audience.trialEnding',
    line: 'announce.audience.trialEndingLine',
  },
};

const pad = (value: number) => String(value).padStart(2, '0');

/** A moment as `<input type="datetime-local">` writes it, in local time. */
const toLocalInput = (at: number) => {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Ten tomorrow morning: the day before most of a day's trials end. */
const tomorrowMorning = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date.getTime();
};

const dayKey = (at: number, plusDays: number) => {
  const date = new Date(at);
  date.setDate(date.getDate() + plusDays);
  return {
    key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    date,
  };
};

interface IAnnouncementComposerProps {
  /** One not yet out, to change; undefined for a new one. */
  editing: IAdminAnnouncement | undefined;
  /** Every live trial's end, or undefined while unknown. */
  trialEnds: number[] | undefined;
  saving: boolean;
  onSave: (draft: IAnnouncementDraft) => void;
  onCancelEdit: () => void;
}

/**
 * Writing an announcement: its title and line, up to six of FluidEQ's own
 * scenes in the order they will be framed (the first the big one), the
 * moment it goes out — with how many trials end the day after, which is the
 * day to choose it by — and who sees it. Preview shows the card exactly as a
 * member on a trial will meet it, and sends nothing.
 *
 * Its form starts from `editing` when mounted; the page keys it by the
 * announcement, so opening another one starts a fresh form.
 */
export default function AnnouncementComposer({
  editing,
  trialEnds,
  saving,
  onSave,
  onCancelEdit,
}: IAnnouncementComposerProps) {
  const { t, locale } = useTranslation();
  const scenes = useUsableScenes();
  const ids = useId();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [picked, setPicked] = useState<string[]>(
    editing?.scenes.map((scene) => scene.sceneId) ?? [],
  );
  const [when, setWhen] = useState(
    toLocalInput(editing?.startsAt ?? tomorrowMorning()),
  );
  const [audience, setAudience] = useState<TAnnouncementAudience>(
    editing?.audience ?? 'everyone',
  );

  const startsAt = Date.parse(when);
  const ready =
    title.trim().length > 0 &&
    picked.length > 0 &&
    Number.isFinite(startsAt) &&
    !saving;

  const toggle = (id: string) =>
    setPicked((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      return current.length < MAX_ANNOUNCEMENT_SCENES
        ? [...current, id]
        : current;
    });

  const draft = (): IAnnouncementDraft => ({
    ...(editing ? { id: editing.id } : {}),
    title: title.trim(),
    body: body.trim(),
    scenes: picked,
    startsAt,
    audience,
  });

  const preview = () => {
    previewAnnouncement({
      id: 0,
      title: title.trim() || t('announce.untitled'),
      body: body.trim(),
      scenes: picked.flatMap((id) => {
        const scene = scenes.find((entry) => entry.id === id);
        return scene
          ? [{ sceneId: scene.id, version: scene.version, names: scene.names }]
          : [];
      }),
      startsAt: Number.isFinite(startsAt) ? startsAt : Date.now(),
      // As a member whose trial ends tomorrow meets it: the line included.
      trialEndsAt: Date.now() + ANNOUNCEMENT_TRIAL_WINDOW_MS / 2,
    });
  };

  const dates = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const numbers = new Intl.NumberFormat(locale);
  const byDay = trialEnds ? trialEndsByDay(trialEnds) : undefined;
  const dayAfter = Number.isFinite(startsAt) ? dayKey(startsAt, 1) : undefined;
  const twoAfter = Number.isFinite(startsAt) ? dayKey(startsAt, 2) : undefined;

  return (
    <div className="announce-composer">
      <section className="announce-composer__card">
        <label className="announce-composer__field" htmlFor={`${ids}-title`}>
          <span>{t('announce.field.title')}</span>
          <input
            id={`${ids}-title`}
            type="text"
            value={title}
            maxLength={MAX_ANNOUNCEMENT_TITLE}
            placeholder={t('announce.field.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="announce-composer__field" htmlFor={`${ids}-body`}>
          <span>{t('announce.field.body')}</span>
          <textarea
            id={`${ids}-body`}
            value={body}
            rows={3}
            maxLength={MAX_ANNOUNCEMENT_BODY}
            placeholder={t('announce.field.bodyPlaceholder')}
            onChange={(event) => setBody(event.target.value)}
          />
          <span className="announce-composer__count">
            {numbers.format(body.length)} /{' '}
            {numbers.format(MAX_ANNOUNCEMENT_BODY)}
          </span>
        </label>
        <div className="announce-composer__field">
          <span>
            {t('announce.field.scenes', {
              count: numbers.format(picked.length),
              most: numbers.format(MAX_ANNOUNCEMENT_SCENES),
            })}
          </span>
          {scenes.length === 0 && (
            <p className="gallery-fine">{t('announce.field.noScenes')}</p>
          )}
          <ul className="announce-composer__picker">
            {scenes.map((scene) => {
              const order = picked.indexOf(scene.id);
              const name = resolveSceneName(scene, locale);
              return (
                <li key={scene.id}>
                  <button
                    type="button"
                    className={`announce-composer__pick${order >= 0 ? ' is-picked' : ''}`}
                    aria-pressed={order >= 0}
                    disabled={
                      order < 0 && picked.length >= MAX_ANNOUNCEMENT_SCENES
                    }
                    onClick={() => toggle(scene.id)}
                  >
                    <ScenePicture
                      scene={{
                        lookId: scene.lookId,
                        authorId: FLUIDEQ_CREATOR_ID,
                        sceneId: scene.id,
                        version: scene.version,
                      }}
                    />
                    <span className="announce-composer__pick-name">{name}</span>
                    {order >= 0 && (
                      <span
                        className="announce-composer__pick-order"
                        aria-hidden="true"
                      >
                        {numbers.format(order + 1)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="announce-composer__card">
        <label className="announce-composer__field" htmlFor={`${ids}-when`}>
          <span>{t('announce.field.when')}</span>
          <input
            id={`${ids}-when`}
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>
        {byDay && dayAfter && twoAfter && (
          <p className="announce-composer__trials">
            {t('announce.trials.dayAfter', {
              count: numbers.format(byDay.get(dayAfter.key) ?? 0),
              date: dates.format(dayAfter.date),
            })}
            {(byDay.get(twoAfter.key) ?? 0) > 0 &&
              ` ${t('announce.trials.twoAfter', {
                count: numbers.format(byDay.get(twoAfter.key) ?? 0),
              })}`}
          </p>
        )}
        <fieldset className="announce-composer__audiences">
          <legend>{t('announce.field.audience')}</legend>
          {ANNOUNCEMENT_AUDIENCES.map((entry) => (
            <label
              key={entry}
              htmlFor={`${ids}-audience-${entry}`}
              className={`announce-composer__audience${audience === entry ? ' is-chosen' : ''}`}
            >
              <input
                id={`${ids}-audience-${entry}`}
                type="radio"
                name={`${ids}-audience`}
                checked={audience === entry}
                onChange={() => setAudience(entry)}
              />
              <span>
                <span className="announce-composer__audience-name">
                  {t(AUDIENCES[entry].name)}
                </span>
                <span className="announce-composer__audience-line">
                  {t(AUDIENCES[entry].line)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="announce-composer__foot">
          <span className="announce-composer__actions">
            {editing && (
              <button
                type="button"
                className="button small subtle"
                onClick={onCancelEdit}
              >
                {t('announce.stopEditing')}
              </button>
            )}
            <button
              type="button"
              className="button small subtle"
              disabled={picked.length === 0}
              onClick={preview}
            >
              {t('announce.preview')}
            </button>
            <button
              type="button"
              className={`button small${saving ? ' is-running' : ''}`}
              aria-busy={saving}
              disabled={!ready}
              onClick={() => onSave(draft())}
            >
              {editing ? t('announce.saveChanges') : t('announce.schedule')}
            </button>
          </span>
        </div>
      </section>
    </div>
  );
}
