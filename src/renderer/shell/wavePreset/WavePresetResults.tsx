/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n/en';
import { useTranslation } from '../../utils/I18nContext';
import {
  findsInOrder,
  type IPresetFind,
  type IPresetSearch,
  type TSearchGroup,
} from './presetSearch';
import type { TPresetBrowse } from './usePresetBrowse';
import WavePresetPick from './WavePresetPick';
import { fillSlot, fromFirstMark, markedText } from './WavePresetText';

/** Each group's name, as the Preset tab and the rack's picker say it. */
const GROUP_LABEL: Record<TSearchGroup, TranslationKey> = {
  saved: 'dsp.eqPreset.saved',
  basic: 'dsp.eqPresetGroup.basic',
  genre: 'voicing.groupGenre',
  scene: 'dsp.eqPresetGroup.scene',
  repair: 'dsp.eqPresetGroup.repair',
};

/** A few words that find something in every language: names it shows. */
const SUGGESTED = ['car', 'vinyl-restore', 'speech'];

interface IWavePresetResultsProps {
  browse: TPresetBrowse;
  search: IPresetSearch;
}

/**
 * What the plate's search found (design A): by name first, a section per
 * group with its count, then what the others do — a genre's line, or a stage
 * the rack runs — and a last line saying that is all of them. Nothing found
 * says what was looked at and offers words that do find something.
 */
const WavePresetResults = ({ browse, search }: IWavePresetResultsProps) => {
  const { t } = useTranslation();
  const typed = browse.query.trim();
  const quoted = <q className="wave-preset-menu__quote">{typed}</q>;
  const { terms } = search;

  if (search.count === 0) {
    const words = [
      ...SUGGESTED.flatMap((id) => {
        const preset = browse.catalog.find((one) => one.id === id);
        return preset ? [preset.name] : [];
      }),
      t('dsp.bassPunch.title'),
    ];
    return (
      <div className="wave-preset-menu__empty">
        <strong>{fillSlot(t('wavePreset.emptyTitle'), 'query', quoted)}</strong>
        <span>{t('wavePreset.emptyNote')}</span>
        <span className="wave-preset-menu__try">
          {words.map((word) => (
            <button
              key={word}
              type="button"
              className="wave-preset-menu__word"
              onClick={() => {
                browse.setQuery(word);
                browse.inputRef.current?.focus({ preventScroll: true });
              }}
            >
              {word}
            </button>
          ))}
        </span>
      </div>
    );
  }

  // Each find's place among the rows the keys walk, in the order drawn.
  const places = new Map(
    findsInOrder(search).map(({ preset }, place) => [preset.id, place]),
  );
  const pick = (find: IPresetFind, byName: boolean) => {
    const { because } = find;
    let shownHint: ReactNode;
    if (because?.kind === 'hook') {
      shownHint = markedText(fromFirstMark(because.text, terms), terms);
    } else if (because?.kind === 'stage') {
      // Only the stage that matched, so the lit word is never the part an
      // ellipsis cuts off.
      shownHint = fillSlot(
        t('wavePreset.runs'),
        'stage',
        markedText(because.text, terms),
      );
    }
    return (
      <WavePresetPick
        key={find.preset.id}
        browse={browse}
        preset={find.preset}
        index={places.get(find.preset.id) ?? 0}
        nameTerms={byName ? terms : undefined}
        hint={
          because?.kind === 'stage'
            ? t('wavePreset.runs', { stage: because.text })
            : because?.text
        }
        shownHint={shownHint}
      />
    );
  };

  return (
    <>
      {search.byName.map(({ group, finds }) => (
        <div key={group} className="wave-preset-menu__section">
          <span className="wave-preset-menu__group">
            {t(GROUP_LABEL[group])}
            <span className="wave-preset-menu__count">{finds.length}</span>
          </span>
          {finds.map((find) => pick(find, true))}
        </div>
      ))}
      {search.byWhat.length > 0 && (
        <div className="wave-preset-menu__section is-by-what">
          <span className="wave-preset-menu__group">
            {t('wavePreset.byWhat')}
            {quoted}
            <span className="wave-preset-menu__count">
              {search.byWhat.length}
            </span>
          </span>
          {search.byWhat.map((find) => pick(find, false))}
        </div>
      )}
      <p className="wave-preset-menu__end">
        {fillSlot(
          search.count === 1
            ? t('wavePreset.endOne')
            : t('wavePreset.endMany', { count: search.count }),
          'query',
          quoted,
        )}
      </p>
    </>
  );
};

export default WavePresetResults;
