/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { NEUTRAL_RESPONSE } from 'common/sceneResponse';
import { SPECTRUM_TEXELS, WAVEFORM_TEXELS } from 'common/sceneUniformContract';
import type { IStudioChat } from 'common/studioChat';
import type { IStudioState } from 'main/ipc/memberScenes';
import Glyph from '../../community/Glyph';
import type { ISceneFrame } from '../../graph/sceneGl';
import StudioChatEffortDots from '../../studio/chat/StudioChatEffortDots';
import StudioChatModelPick from '../../studio/chat/StudioChatModelPick';
import StudioChatThread from '../../studio/chat/StudioChatThread';
import StudioListen from '../../studio/StudioListen';
import StudioMeters from '../../studio/StudioMeters';
import StudioProjects from '../../studio/StudioProjects';
import StudioShipCard from '../../studio/StudioShipCard';
import type { TStageHeard } from '../../studio/StudioStage';
import StudioStageArea from '../../studio/StudioStageArea';
import StudioStageControls from '../../studio/StudioStageControls';
import StudioStageReading from '../../studio/StudioStageReading';
import StudioVersion from '../../studio/StudioVersion';
import StudioWorkTabs from '../../studio/StudioWorkTabs';
import { useTranslation } from '../../utils/I18nContext';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import { PlusTab } from './plusFigures';
import '../../styles/Studio.scss';
import '../../styles/StudioStage.scss';
import '../../styles/StudioMaker.scss';
import '../../styles/StudioWork.scss';

/**
 * The Studio chapter's bench, drawn by the bench's own parts
 * (`helpChapters/plus.ts`) for a made-up member's project, Northern Lake:
 * its project picker, version and ship card, the stage with its reading and
 * controls, the work tabs open on What it hears — the test signals and the
 * meters, given one made-up moment of music — and the chat beside the stage
 * with one exchange in it.
 *
 * The stage plays the scene on the graphics card and the meters follow
 * it; here the stage is the Aurora still the app ships, under the stage's
 * markup, class for class, as `StudioStage` draws it. The chat's head and
 * its message box are their markup as `StudioChat` and
 * `StudioChatComposer` draw them, around the chat's own thread: each of
 * those reads the reader's own Claude account, session and draft.
 */

const nothing = () => undefined;

const NAME = 'Northern Lake';
const VERSION = 12;

const STATE: IStudioState = {
  mayAddProject: true,
  projectsRoot: 'FluidEQ Studio',
  projects: [
    {
      id: 'help-northern-lake',
      folderName: 'northern-lake',
      path: 'FluidEQ Studio/northern-lake',
      names: { en: NAME },
    },
  ],
  activeId: 'help-northern-lake',
  look: { version: VERSION, current: true },
};

const CHAT: IStudioChat = {
  projectId: 'help-northern-lake',
  busy: false,
  entries: [
    {
      kind: 'me',
      id: 'help-ask',
      text: 'Make the aurora swell with the bass, and let a boat cross the lake now and then.',
    },
    {
      kind: 'claude',
      id: 'help-answer',
      text: 'Done. The aurora now swells with the bass, and a small boat crosses the lake about once a minute.',
      steps: [
        { id: 'help-look', kind: 'look', state: 'done', picture: aurora },
        { id: 'help-read', kind: 'read', file: 'scene.frag', state: 'done' },
        { id: 'help-write', kind: 'write', file: 'scene.frag', state: 'done' },
      ],
      state: 'done',
      version: VERSION,
    },
  ],
};

/** A spectrum that falls off toward the treble, as music's does. */
const spectrumOf = () =>
  Uint8Array.from({ length: SPECTRUM_TEXELS }, (_, texel) =>
    Math.round(
      235 * Math.exp(-texel / 170) + 18 * (1 + Math.sin(texel / 9)) + 8,
    ),
  );

/** One moment of a song, loud and on the beat. */
const MOMENT: ISceneFrame = {
  timeSeconds: 84,
  level: 0.78,
  beat: 0.62,
  bands: [0.82, 0.64, 0.58],
  musicAccent: [0.3, 0.2],
  musicRun: [0.5, 0.4],
  accent: [0.25, 0.15, 0.3],
  fade: 1,
  playing: true,
  spectrum: spectrumOf(),
  waveform: new Uint8Array(WAVEFORM_TEXELS).fill(128),
  params: {},
  rhythm: {
    ...SILENT_RHYTHM,
    tempo: 118,
    confidence: 0.86,
    kick: 0.9,
    snare: 0.2,
    hat: 0.5,
    intensity: 0.66,
    build: 0.35,
    drop: 0.1,
    dropSerial: 3,
    running: true,
  },
  stereo: [0.02, 0.34],
  voice: [0.42, 0.3, 0.2],
};

/** The Studio on a member's project, the chat beside its stage. */
const StudioDrawing = () => {
  const { t } = useTranslation();
  const feed = useRef<TStageHeard | undefined>(undefined);
  const reading = useRef<HTMLSpanElement>(null);
  const tabs = useMemo(
    () =>
      (
        [
          ['tune', 'studio.work.tune'],
          ['code', 'studio.code.title'],
          ['drawing', 'studio.performance.title'],
          ['hears', 'studio.meters.title'],
        ] as const
      ).map(([id, label]) => ({ id, label: t(label) })),
    [t],
  );

  // Told about the moment once the meters are listening (their effect runs
  // before this one), and the reading written where the stage writes it.
  useEffect(() => {
    feed.current?.(MOMENT, MOMENT, 0.3);
    if (reading.current) {
      reading.current.textContent = t('studio.cost.reading', {
        ms: '1.4',
        fps: '60',
        size: '100',
      });
    }
  }, [t]);

  const stage = (
    <div className="studio-stage__well">
      <div className="studio-stage studio-stage--graph">
        <div className="studio-stage__screen">
          <div
            className="studio-stage__canvas"
            style={{ width: '100%', height: '100%' } as CSSProperties}
          >
            <img
              src={aurora}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
        <div className="studio-stage__bar">
          <StudioStageReading
            cost="studio.cost.full"
            percent={100}
            readingRef={reading}
          />
          <StudioStageControls
            isFullscreen={false}
            onFullscreen={nothing}
            isPlayer={false}
            onPlayer={nothing}
          />
        </div>
      </div>
    </div>
  );

  return (
    <PlusTab shown="studio" height={834}>
      <header className="community__head">
        <span className="community__head-mark" aria-hidden="true">
          <Glyph name="studio" />
        </span>
        <span className="community__head-text">
          <span className="community__head-name">{t('studio.title')}</span>
          <span className="community__head-description">
            {t('studio.description')}
          </span>
        </span>
      </header>
      <div className="studio">
        <div className="studio-bench">
          <div className="studio-bench__top">
            <StudioProjects
              state={STATE}
              onNewProject={nothing}
              onLinkFolder={nothing}
              onOpenFile={nothing}
            />
            <StudioVersion
              version={VERSION}
              published={VERSION - 1}
              look={STATE.look}
            />
            <span className="studio-bench__status is-live">
              <span className="studio-bench__lamp" aria-hidden="true" />
              {t('studio.status.live')}
            </span>
            <div className="studio-bench__ship">
              <StudioShipCard
                unfit={false}
                onAdd={nothing}
                publishing={false}
                onPublish={nothing}
                exporting={false}
                onExport={nothing}
                onSetDesktop={nothing}
                settingDesktop={false}
              />
            </div>
          </div>

          <div className="studio-bench__grid studio-bench__grid--graph">
            <div className="studio-bench__main">
              <StudioStageArea stage={stage} resizable={false}>
                {null}
              </StudioStageArea>
              <StudioWorkTabs
                label={t('studio.work.label')}
                tabs={tabs}
                selected="hears"
                onSelect={nothing}
              >
                <div className="studio-work__hears">
                  <StudioListen signal="live" onSignal={nothing} idle={false} />
                  <StudioMeters feed={feed} response={NEUTRAL_RESPONSE} />
                </div>
              </StudioWorkTabs>
            </div>

            <aside className="studio-bench__chat">
              <section className="studio-chat">
                <header className="studio-chat__head">
                  <span
                    className="studio-chat__lamp is-ready"
                    aria-hidden="true"
                  />
                  <span className="studio-chat__who">
                    <span className="studio-chat__name">
                      {t('studioChat.title')}
                    </span>
                    <button type="button" className="studio-chat__where">
                      {t('studioChat.wherePlan', { plan: 'Pro' })}
                    </button>
                  </span>
                  <button
                    type="button"
                    className="studio-chat__icon"
                    aria-label={t('studioChat.past.title')}
                  >
                    <Glyph name="history" />
                  </button>
                  <button
                    type="button"
                    className="studio-chat__icon"
                    aria-label={t('studioChat.new')}
                  >
                    <Glyph name="plus" />
                  </button>
                </header>
                <StudioChatThread
                  chat={CHAT}
                  sceneName={NAME}
                  version={VERSION}
                  onIdea={nothing}
                  onCarryOn={nothing}
                  onRetry={nothing}
                />
                <form className="studio-chat__composer">
                  <div className="studio-chat__box">
                    <textarea
                      aria-label={t('studioChat.label')}
                      rows={2}
                      readOnly
                      placeholder={t('studioChat.placeholder')}
                    />
                    <div className="studio-chat__bar">
                      <button
                        type="button"
                        className="studio-chat__attach"
                        aria-label={t('studioChat.attach')}
                      >
                        <Glyph name="camera" />
                      </button>
                      <StudioChatModelPick disabled={false} />
                      <StudioChatEffortDots disabled={false} />
                      <button
                        type="submit"
                        className="button small studio-chat__send"
                        aria-label={t('studioChat.send')}
                        disabled
                      >
                        <Glyph name="arrow-up" />
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </PlusTab>
  );
};

export default StudioDrawing;
