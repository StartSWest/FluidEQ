/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import { IGameProfile, IGameProgram, TGameSource } from '../../common/games';
import { TranslationKey } from '../../common/i18n/en';
import { useDspPresetCatalog } from '../dsp/dspPresetCatalog';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import GameIcon from './GameIcon';
import GameRow from './GameRow';
import { addGameProfile, removeGameProfile } from './gameProfiles';
import { useGameSound } from './useGameSound';
import '../styles/Games.scss';

interface IGamesBridge {
  gamePrograms?: () => Promise<unknown>;
  chooseGameProgram?: () => Promise<unknown>;
}

const isProgram = (value: unknown): value is IGameProgram =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IGameProgram).name === 'string' &&
  typeof (value as IGameProgram).path === 'string';

const sourceKey = (source: TGameSource): TranslationKey =>
  `games.source.${source}` as TranslationKey;

/**
 * Game profiles: a program, the sound it should play, and the app switching
 * to it the moment Windows puts that program in front.
 *
 * The list to add from is what the launchers say is installed — Steam, the
 * Epic launcher, EA, GOG, Ubisoft, Battle.net and the Xbox app — and what has
 * a window right now, for anything none of them knows about. A game does not
 * have to be running to be given a sound, which is the whole point of asking
 * the launchers rather than the task list.
 */
const GamesPanel = () => {
  const { t } = useTranslation();
  // Watching while the page is open as well, so the line at the top can say
  // what is in front while a profile is being made for it.
  const { profiles, playing } = useGameSound({ always: true });
  const { catalog, favorites } = useDspPresetCatalog(t);
  const [known, setKnown] = useState<IGameProgram[]>([]);
  const [asked, setAsked] = useState(false);

  const bridge = window.electron?.ipcRenderer as IGamesBridge | undefined;

  useEffect(() => {
    const ask = bridge?.gamePrograms;
    if (!ask) {
      setAsked(true);
      return undefined;
    }
    let gone = false;
    const programsOf = (answer: unknown): IGameProgram[] => {
      if (typeof answer !== 'object' || answer === null) {
        return [];
      }
      const { installed, running } = answer as {
        installed?: unknown;
        running?: unknown;
      };
      return [
        ...(Array.isArray(installed) ? installed : []),
        ...(Array.isArray(running) ? running : []),
      ].filter(isProgram);
    };
    ask()
      .then((answer) => {
        if (!gone) {
          setKnown(programsOf(answer));
        }
        return undefined;
      })
      // A machine whose launchers cannot be read still has its own programs,
      // and a list that never says it finished is a page that never loads.
      .catch(() => undefined)
      .finally(() => {
        if (!gone) {
          setAsked(true);
        }
      });
    return () => {
      gone = true;
    };
  }, [bridge]);

  const add = useCallback((program: IGameProgram) => {
    addGameProfile({
      name: program.name,
      path: program.path,
      source: program.source,
    });
  }, []);

  const choose = useCallback(async () => {
    const pick = bridge?.chooseGameProgram;
    if (!pick) {
      return;
    }
    const chosen = await pick();
    if (isProgram(chosen)) {
      add(chosen);
    }
  }, [add, bridge]);

  const taken = new Set(profiles.map((profile) => profile.path.toLowerCase()));
  const entries = known
    .filter((program) => !taken.has(program.path.toLowerCase()))
    .map((program) => ({
      id: program.path,
      name: program.name,
      hint: t(sourceKey(program.source)),
      group: program.source === 'running' ? 'running' : 'installed',
      icon: <GameIcon program={program} className="rich-pick__glyph" />,
    }));

  return (
    <div className="games-page">
      <div className="games-head">
        <p className="games-front is-on" aria-live="polite">
          {playing ? (
            <>
              <span className="games-front__pip" aria-hidden="true" />
              {t('games.front.playing', { name: playing.name })}
            </>
          ) : null}
        </p>
        <RichPick
          className="games-add"
          entries={entries}
          groupLabel={(group) =>
            group === 'running'
              ? t('games.group.running')
              : t('games.group.installed')
          }
          activeId=""
          onPick={(id) => {
            const program = known.find((one) => one.path === id);
            if (program) {
              add(program);
            }
          }}
          placeholder={t('games.add')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('games.add')}
          triggerTitle={t('games.addHint')}
          disabled={!asked}
          renderFooter={(close) => (
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                close();
                choose().catch(() => undefined);
              }}
            >
              {t('games.choose')}
            </button>
          )}
        />
      </div>

      {profiles.length === 0 ? (
        <div className="games-empty">
          {/* The page's own picture, at the size an empty page can carry:
              a pad with a sound coming off it, which is the whole feature in
              one drawing. */}
          <svg
            className="games-empty__art"
            viewBox="0 0 120 72"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              className="games-empty__body"
              d="M30 20h20a16 16 0 0 1 16 16v3a11 11 0 0 1-19.6 6.9L44 43H36l-2.4 2.9A11 11 0 0 1 14 39v-3a16 16 0 0 1 16-16z"
            />
            <path
              className="games-empty__pad"
              strokeWidth="2.2"
              d="M24 32v8M20 36h8M52 32.5h.01M58 38h.01M46 38h.01M52 43.5h.01"
            />
            <path
              className="games-empty__wave"
              strokeWidth="2.4"
              d="M78 26a14 14 0 0 1 0 20"
            />
            <path
              className="games-empty__wave"
              strokeWidth="2.4"
              d="M88 18a25 25 0 0 1 0 36"
            />
            <path
              className="games-empty__wave"
              strokeWidth="2.4"
              d="M98 10a36 36 0 0 1 0 52"
            />
          </svg>
          <p className="games-empty__title">{t('games.empty.title')}</p>
          <p className="games-empty__more">{t('games.empty.more')}</p>
        </div>
      ) : (
        <ul className="games-list">
          {profiles.map((profile: IGameProfile) => (
            <GameRow
              key={profile.id}
              profile={profile}
              catalog={catalog}
              favourites={favorites}
              isPlaying={playing?.id === profile.id}
              onRemove={() => removeGameProfile(profile.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default GamesPanel;
