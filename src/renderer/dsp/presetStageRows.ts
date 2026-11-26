/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspSettings } from '../../common/dsp/chain';
import { DENOISE_PRESETS } from '../../common/dsp/denoisePresets';
import type { TGenreStage } from '../../common/dsp/genreRack';
import { MASTER_PRESETS } from '../../common/dsp/masterPresets';
import { roomPresetOf } from '../../common/dsp/roomPresets';
import {
  BASS_FORGE_CATALOGUE,
  BASS_PUNCH_CATALOGUE,
  DE_ESSER_CATALOGUE,
  DIMENSION_CATALOGUE,
  EXCITER_CATALOGUE,
  MAXIMIZER_CATALOGUE,
} from '../../common/dsp/stageCatalogues';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';
import type { IDspCatalogEntry } from './dspPresetCatalog';
import { genreNoteKey, genreNotesFor } from './genreNotesModel';
import {
  bassForgeFigures,
  bassPunchFigures,
  deEsserFigures,
  denoiseFigures,
  dimensionFigures,
  exciterFigures,
  masterFigures,
  maximizerFigures,
} from './stageFigures';

/** One stage a preset runs, as its notes on the Preset tab list it. */
export interface IPresetStageRow {
  key: string;
  /** The stage's name, as the DSP page's rail gives it. */
  title: string;
  /**
   * The stage's own profile the preset set it from, by the name its picker
   * gives it, when that says something the preset's own name does not.
   */
  profile?: string;
  /** Its figures, as its picker prints them under a profile. */
  figures?: string;
  /** For a genre: what its notes say this stage does there. */
  line?: string;
}

type TProfiles = readonly { id: string; labelKey: string; group: string }[];

/**
 * The name of the profile `id` names in a stage's list, if it is one of the
 * stage's own. A genre's profiles are named for the genre and set each
 * stage the genre runs: on a copy of Pop, "Pop" before every stage's
 * figures said one thing five times, and the figures say what it does.
 */
const profileName = (
  profiles: TProfiles,
  id: string,
  t: Translate,
): string | undefined => {
  const profile = profiles.find((one) => one.id === id);
  return profile && profile.group !== 'genre'
    ? t(profile.labelKey as TranslationKey)
    : undefined;
};

/** The room a preset stands in, by the name the Room's picker gives it. */
const roomName = (settings: IDspSettings, t: Translate): string | undefined => {
  const room = roomPresetOf(settings.room.presetId);
  return room ? t(room.labelKey as TranslationKey) : undefined;
};

/**
 * What a preset's rack runs, stage by stage in rack order — the same stages,
 * in the same order and on the same rules, as `dspPresetStages` names as
 * chips — each with the figures its picker on the DSP page prints, the name
 * of the profile it was set from, and for a genre the line its notes give
 * that stage. Nothing here is written for the pane: every word is a stage's,
 * a picker's or a genre's own.
 *
 * A stage's profile is named only where it is one of the stage's own and
 * not the preset's own name: "Maximizer · Speakers" under Speakers says
 * nothing twice.
 */
export const presetStageRows = (
  preset: Pick<IDspCatalogEntry, 'id' | 'name' | 'settings' | 'curve'>,
  t: Translate,
): IPresetStageRow[] => {
  const { settings, curve } = preset;
  const notes = genreNotesFor(preset.id);
  const genreLine = (stage: TGenreStage): string | undefined => {
    if (!notes || !notes.stagesOn.includes(stage)) {
      return undefined;
    }
    // The full notes say the Maximizer's line in one voice for every genre
    // (`GenreNotesDialog`): its gain is fixed at the source's own level.
    return stage === 'maximizer'
      ? t('genre.notes.fixedMaximizer')
      : t(genreNoteKey(notes.id, `stage.${stage}`));
  };
  const named = (name: string | undefined) =>
    name === undefined || name === preset.name ? undefined : name;

  const rows: (IPresetStageRow | false)[] = [
    settings.normalizer.mode !== 'off' && {
      key: 'normalizer',
      title: t('dsp.normalizer.title'),
    },
    settings.denoise.enabled && {
      key: 'denoise',
      title: t('dsp.denoise.title'),
      profile: named(
        profileName(DENOISE_PRESETS, settings.denoise.presetId, t),
      ),
      figures: denoiseFigures(settings.denoise, t),
    },
    settings.deEsser.enabled && {
      key: 'deEsser',
      title: t('dsp.deEsser.title'),
      profile: named(
        profileName(DE_ESSER_CATALOGUE.profiles, settings.deEsser.presetId, t),
      ),
      figures: deEsserFigures(settings.deEsser, t),
      line: genreLine('deEsser'),
    },
    settings.exciter.enabled && {
      key: 'exciter',
      title: t('dsp.exciter.title'),
      profile: named(
        profileName(EXCITER_CATALOGUE.profiles, settings.exciter.presetId, t),
      ),
      figures: exciterFigures(settings.exciter, t),
      line: genreLine('exciter'),
    },
    settings.bassForge.enabled && {
      key: 'bassForge',
      title: t('dsp.bassForge.title'),
      profile: named(
        profileName(
          BASS_FORGE_CATALOGUE.profiles,
          settings.bassForge.presetId,
          t,
        ),
      ),
      figures: bassForgeFigures(settings.bassForge),
      line: genreLine('bassForge'),
    },
    // Its tone counts as EQ wherever it plays, as the chips count it; the
    // curve is drawn above, so the row has nothing more to say of it.
    (settings.eq.enabled || curve !== undefined) && {
      key: 'eq',
      title: t('dsp.eq.title'),
    },
    settings.footsteps.enabled && {
      key: 'footsteps',
      title: t('dsp.footsteps.title'),
    },
    settings.bassPunch.enabled && {
      key: 'bassPunch',
      title: t('dsp.bassPunch.title'),
      profile: named(
        profileName(
          BASS_PUNCH_CATALOGUE.profiles,
          settings.bassPunch.presetId,
          t,
        ),
      ),
      figures: bassPunchFigures(settings.bassPunch),
      line: genreLine('bassPunch'),
    },
    settings.room.enabled && {
      key: 'room',
      title: t('dsp.room.title'),
      profile: named(roomName(settings, t)),
    },
    settings.dimension.enabled && {
      key: 'dimension',
      title: t('dsp.dimension.title'),
      profile: named(
        profileName(
          DIMENSION_CATALOGUE.profiles,
          settings.dimension.presetId,
          t,
        ),
      ),
      figures: dimensionFigures(settings.dimension),
      line: genreLine('dimension'),
    },
    settings.maximizer.enabled && {
      key: 'maximizer',
      title: t('dsp.maximizer.title'),
      profile: named(
        profileName(
          MAXIMIZER_CATALOGUE.profiles,
          settings.maximizer.presetId,
          t,
        ),
      ),
      figures: maximizerFigures(settings.maximizer),
      line: genreLine('maximizer'),
    },
    settings.master.enabled && {
      key: 'master',
      title: t('dsp.master.title'),
      profile: named(profileName(MASTER_PRESETS, settings.master.presetId, t)),
      figures: masterFigures(settings.master),
    },
  ];
  return rows.filter((row): row is IPresetStageRow => row !== false);
};
