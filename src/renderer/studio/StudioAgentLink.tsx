import { useEffect, useId, useRef, useState } from 'react';
import { songClock } from 'common/songMap';
import Glyph from '../community/Glyph';
import { useHeardSeconds, useHeardSounding } from '../graph/heardSongs';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import {
  loadStudioAgentDoor,
  newStudioAgentDoorKey,
  setStudioAgentDoorOpen,
  useStudioAgentDoor,
} from './studioAgentDoorStore';
import {
  AGENT_ASSISTANTS,
  agentSetup,
  shownAgentSetup,
  type TAgentAssistant,
} from './studioAgentSetup';
import useSongListening from './useSongListening';
import { selectAll, useStudioCopy } from './useStudioCopy';

/**
 * "Let your AI see the stage": the member's switch for the Studio's agent
 * door (`main/studioAgent/studioAgentDoor.ts`).
 *
 * Nobody has to set anything up: Copy AI prompt opens the door and the prompt
 * carries the connection, so the member's AI connects itself (Ivan,
 * 2026-09-24: "I don't want users to run commands manually"). The switch is
 * for turning it off, and back on; off, it stays off, and nothing listens.
 * Connecting an AI by hand — one the prompt never reached — waits behind a
 * quiet button, with the key cut short on screen (a screenshot of the Studio
 * must not carry it) and whole on the clipboard; a clipboard that refuses
 * shows it whole and selected instead. A new key sits beside that button,
 * where the member can find it to lock out every AI given the old one.
 *
 * While the AI works, the card says the Studio is hearing the music for it
 * (`useSongListening.ts`) and how much of the song it has - or, before any,
 * what to do to give it one.
 */

const ASSISTANT_KEY = 'fluideq.studio.agentAssistant';

const readAssistant = (): TAgentAssistant => {
  try {
    const stored = localStorage.getItem(ASSISTANT_KEY);
    return AGENT_ASSISTANTS.find((name) => name === stored) ?? 'claude';
  } catch {
    // Storage off: the first assistant, as for somebody new.
    return 'claude';
  }
};

const rememberAssistant = (assistant: TAgentAssistant) => {
  try {
    localStorage.setItem(ASSISTANT_KEY, assistant);
  } catch {
    // Storage off: the choice lasts as long as the page.
  }
};

const NAMES = {
  claude: 'studio.agent.claude',
  codex: 'studio.agent.codex',
  other: 'studio.agent.other',
} as const;

const HINTS = {
  claude: 'studio.agent.claudeHint',
  codex: 'studio.agent.codexHint',
  other: 'studio.agent.otherHint',
} as const;

/**
 * The Studio hearing the music for the member's AI: a live dot while sound
 * comes in, still while it rests, and how much of the song is kept. Its own
 * component, because it changes once a second while music plays and the
 * card around it does not.
 */
function StudioAgentHearing() {
  const { t } = useTranslation();
  const seconds = useHeardSeconds();
  const sounding = useHeardSounding();
  return (
    <p className={`studio-agent__hearing${sounding ? ' is-sounding' : ''}`}>
      <span className="studio-agent__hearing-dot" aria-hidden="true" />
      <span className="studio-agent__hearing-title">
        {t('studio.agent.hearing')}
      </span>
      <span className="studio-agent__hearing-detail">
        {seconds > 0
          ? t('studio.agent.hearingSong', { time: songClock(seconds) })
          : t('studio.agent.hearingIdle')}
      </span>
    </p>
  );
}

export default function StudioAgentLink() {
  const { t } = useTranslation();
  const id = useId();
  const setupId = useId();
  const door = useStudioAgentDoor();
  const hearing = useSongListening();
  const [busy, setBusy] = useState(false);
  const [byHand, setByHand] = useState(false);
  const [assistant, setAssistant] = useState(readAssistant);
  const setupRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    loadStudioAgentDoor().catch(() => undefined);
  }, []);

  const change = (run: () => Promise<unknown>) => {
    setBusy(true);
    run()
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const url = door?.open ? door.url : undefined;
  const key = door?.open ? door.key : undefined;
  const setup = url && key ? agentSetup(assistant, url, key) : '';
  const copy = useStudioCopy(setup, setupRef);
  // Refused, the whole setup is shown and selected, so Ctrl+C has it all.
  useEffect(() => {
    if (copy.refused) {
      selectAll(setupRef.current);
    }
  }, [copy.refused, setup]);

  return (
    <div className={`studio-agent${url ? ' is-open' : ''}`}>
      <div className="studio-agent__head">
        <span className="studio-agent__glyph" aria-hidden="true">
          <Glyph name="camera" />
        </span>
        <div className="studio-agent__words">
          <label className="studio-agent__title" htmlFor={id}>
            {t('studio.agent.title')}
          </label>
          <span className="studio-agent__text">{t('studio.agent.body')}</span>
        </div>
        <Switch
          id={id}
          ariaLabel={t('studio.agent.title')}
          isOn={door?.open === true}
          isDisabled={!door || busy}
          handleToggle={() => change(() => setStudioAgentDoorOpen(!door?.open))}
        />
      </div>

      {hearing && <StudioAgentHearing />}

      {door?.failed && (
        <p className="studio-notice" role="alert">
          {t('studio.agent.failed')}
        </p>
      )}

      {url && key && (
        <>
          <div className="studio-maker__row">
            <button
              type="button"
              className="button small subtle"
              aria-expanded={byHand}
              aria-controls={byHand ? setupId : undefined}
              onClick={() => setByHand((shown) => !shown)}
            >
              {t('studio.agent.byHand')}
            </button>
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={() => change(newStudioAgentDoorKey)}
            >
              <Glyph name="refresh" />
              {t('studio.agent.newKey')}
            </button>
          </div>
          <span className="studio-agent__key">
            <Glyph name="shield" />
            {t('studio.agent.keyHint')}
          </span>
        </>
      )}

      {url && key && byHand && (
        <div id={setupId} className="studio-agent__setup">
          <div className="studio-agent__setup-head">
            <span className="studio-agent__setup-title">
              {t('studio.agent.setupTitle')}
            </span>
            <div
              className="studio-agent__assistants"
              role="group"
              aria-label={t('studio.agent.assistant')}
            >
              {AGENT_ASSISTANTS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="studio-idea"
                  aria-pressed={name === assistant}
                  onClick={() => {
                    setAssistant(name);
                    rememberAssistant(name);
                  }}
                >
                  {t(NAMES[name])}
                </button>
              ))}
            </div>
          </div>
          <pre
            ref={setupRef}
            className="studio-prompt studio-agent__code"
            role="region"
            // A scrolling box must take focus, or no keyboard can scroll it
            // (WCAG 2.1.1); the region role and label say what it is.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            aria-label={t('studio.agent.setupTitle')}
          >
            {copy.refused ? setup : shownAgentSetup(assistant, url, key)}
          </pre>
          <span className="studio-agent__hint">{t(HINTS[assistant])}</span>
          <div className="studio-maker__row">
            <button type="button" className="button small" onClick={copy.copy}>
              <Glyph name={copy.done ? 'check' : 'copy'} />
              {t(copy.done ? 'studio.maker.copied' : 'studio.agent.copy')}
            </button>
          </div>
          {copy.refused && (
            <p className="studio-notice" role="status">
              {t('studio.agent.copyFailed')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
