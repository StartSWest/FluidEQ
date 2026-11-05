/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useEffectEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { IGameProfile, IGameProgram, TGameSource } from '../../common/games';
import { suggestGamingProfile } from '../../common/gaming';
import type { TranslationKey } from '../../common/i18n/en';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import GameIcon from './GameIcon';
import { addGameProfile, fillGameProfileIcons } from './gameProfiles';
import { GAMING_KIND_LABEL_KEYS, gamingProfileEntry } from './gamingCatalog';
import { useYoursGamingProfiles } from './useGamingData';

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

interface IGamingAddDialogProps {
  games: readonly IGameProfile[];
  /** A profile chosen already, from the Gaming profiles list. */
  profileId?: string;
  onAdded: (gameId: string) => void;
  onClose: () => void;
}

/**
 * Adding a game: what the launchers say is installed and what has a window
 * right now, each with the Gaming profile it would start from — the one made
 * for its title, or the one for any game — and a program picked by hand for
 * anything none of them knows about.
 *
 * A game does not have to be running to be added, which is the point of
 * asking the launchers rather than the task list.
 */
const GamingAddDialog = ({
  games,
  profileId,
  onAdded,
  onClose,
}: IGamingAddDialogProps) => {
  const { t } = useTranslation();
  const yours = useYoursGamingProfiles();
  const [known, setKnown] = useState<IGameProgram[]>([]);
  const [asked, setAsked] = useState(false);
  const [picked, setPicked] = useState<string>();
  const bridge = window.electron?.ipcRenderer as IGamesBridge | undefined;

  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => closeOnEscape(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const ask = bridge?.gamePrograms;
    if (!ask) {
      setAsked(true);
      return undefined;
    }
    let gone = false;
    ask()
      .then((answer) => {
        if (gone || typeof answer !== 'object' || answer === null) {
          return undefined;
        }
        const { installed, running } = answer as {
          installed?: unknown;
          running?: unknown;
        };
        const programs = [
          ...(Array.isArray(running) ? running : []),
          ...(Array.isArray(installed) ? installed : []),
        ].filter(isProgram);
        setKnown(programs);
        // Rows saved before their icon was carried across get it here, the
        // first time the launchers answer again.
        fillGameProfileIcons(programs);
        return undefined;
      })
      // A machine whose launchers cannot be read still has its own
      // programs, and a list that never says it finished never loads.
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

  const taken = new Set(games.map((game) => game.path.toLowerCase()));
  const offered = known.filter(
    (program) => !taken.has(program.path.toLowerCase()),
  );
  const running = offered.filter((program) => program.source === 'running');
  const installed = offered.filter((program) => program.source !== 'running');
  const chosen =
    offered.find((program) => program.path === picked) ??
    running[0] ??
    installed[0];
  const startFrom = (program: IGameProgram) =>
    profileId ?? suggestGamingProfile(program.name);

  const add = (program: IGameProgram) => {
    const next = addGameProfile(
      {
        name: program.name,
        path: program.path,
        source: program.source,
        ...(program.icon ? { icon: program.icon } : {}),
      },
      startFrom(program),
    );
    const added = next.find(
      (game) => game.path.toLowerCase() === program.path.toLowerCase(),
    );
    if (added) {
      onAdded(added.id);
    }
  };

  const browse = async () => {
    const pick = bridge?.chooseGameProgram;
    if (!pick) {
      return;
    }
    const program = await pick();
    if (isProgram(program)) {
      add(program);
    }
  };

  const row = (program: IGameProgram) => {
    const entry = gamingProfileEntry(startFrom(program), yours, t);
    const kindKey = GAMING_KIND_LABEL_KEYS[entry.kind];
    const isChosen = program.path === chosen?.path;
    return (
      <button
        key={program.path}
        type="button"
        role="radio"
        aria-checked={isChosen}
        className={`gaming-pick${isChosen ? ' is-chosen' : ''}`}
        onClick={() => setPicked(program.path)}
        onDoubleClick={() => add(program)}
      >
        <span className="gaming-pick__radio" aria-hidden="true" />
        <span className="gaming-game__icon">
          <GameIcon program={program} />
        </span>
        <span className="gaming-pick__what">
          <span className="gaming-game__name" title={program.name}>
            {program.name}
          </span>
          <span className="gaming-game__from">
            {t(sourceKey(program.source))}
          </span>
        </span>
        <span className="gaming-pick__starts">
          <span className="gaming-pick__starts-label">
            {t('gaming.addDialog.startsFrom')}
          </span>
          <span className="gaming-pick__profile" title={entry.name}>
            {entry.name}
          </span>
          {kindKey && <span className="gaming-kind">{t(kindKey)}</span>}
        </span>
      </button>
    );
  };

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
        className="gaming-add-dialog"
        icon={<MenuIcon name="plus" />}
        title={t('gaming.addDialog.title')}
        titleId="gaming-add-title"
        description={t('gaming.addDialog.intro')}
        onClose={onClose}
        closeLabel={t('gaming.addDialog.close')}
        footer={
          <>
            <span className="gaming-add-dialog__later">
              {t('gaming.addDialog.later')}
            </span>
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                onClick={onClose}
              >
                {t('gaming.addDialog.cancel')}
              </button>
              <button
                type="button"
                className="button small"
                disabled={!chosen}
                onClick={() => {
                  if (chosen) {
                    add(chosen);
                  }
                }}
              >
                {chosen
                  ? t('gaming.addDialog.add', { game: chosen.name })
                  : t('gaming.add')}
              </button>
            </div>
          </>
        }
      >
        <div className="gaming-add-dialog__body" role="radiogroup">
          {!asked && (
            <p className="gaming-add-dialog__note">
              {t('gaming.addDialog.loading')}
            </p>
          )}
          {asked && offered.length === 0 && (
            <p className="gaming-add-dialog__note">
              {t('gaming.addDialog.none')}
            </p>
          )}
          {running.length > 0 && (
            <div className="gaming-add-dialog__group">
              <span className="gaming-cap">
                {t('gaming.addDialog.running')}
              </span>
              {running.map(row)}
            </div>
          )}
          {installed.length > 0 && (
            <div className="gaming-add-dialog__group">
              <span className="gaming-cap">
                {t('gaming.addDialog.installed')}
              </span>
              {installed.map(row)}
            </div>
          )}
          <button
            type="button"
            className="gaming-add-dialog__browse"
            onClick={() => {
              browse().catch(() => undefined);
            }}
          >
            {t('gaming.addDialog.browse')}
          </button>
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
};

export default GamingAddDialog;
