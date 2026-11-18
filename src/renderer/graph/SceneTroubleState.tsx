/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import SceneLookIcon from '../icons/SceneLookIcon';
import { useTranslation } from '../utils/I18nContext';
import { retryLook } from './lookRefusal';
import SceneLoading from './SceneLoading';
import SceneLoadingFloor from './SceneLoadingFloor';
import type { ISceneTrouble } from './sceneTrouble';

const SAID: Record<
  Exclude<ISceneTrouble['reason'], 'waiting'>,
  TranslationKey
> = {
  compile: 'graph.look.refused.compile',
  heavy: 'graph.look.refused.heavy',
  unavailable: 'graph.look.refused.unavailable',
  driver: 'graph.look.refused.driver',
  gone: 'graph.look.refused.gone',
};

interface ISceneTroubleStateProps {
  trouble: ISceneTrouble;
  /** The panel's size where it is known; absent, it fills its parent. */
  width?: number;
  height?: number;
  /** Try again, where the place has more to clear than the graph's verdict. */
  onRetry?: (lookId: string) => void;
}

/**
 * What stands where a scene the listener chose would be drawn, while it
 * cannot be: its loading while it is on its way, otherwise what happened to
 * it in words, with Try again. Never a standard look in its place (Ivan,
 * 2026-11-14: "only the full scene can show, always") - the standard looks
 * are one press away in the looks menu, chosen by the listener, never put up
 * for them. The words are the log's too: the report carries every failure
 * (`common/sceneFailureLog.ts`).
 */
export default function SceneTroubleState({
  trouble,
  width,
  height,
  onRetry = retryLook,
}: ISceneTroubleStateProps) {
  const { t, locale } = useTranslation();
  const swatch = [...trouble.swatch];
  const size =
    width === undefined || height === undefined ? undefined : { width, height };
  if (trouble.reason === 'waiting') {
    return (
      <>
        <SceneLoadingFloor settled={false} width={width} height={height} />
        <SceneLoading
          lookId={trouble.lookId}
          swatch={swatch}
          width={width}
          height={height}
        />
      </>
    );
  }
  const name = trouble.names
    ? resolveSceneName({ names: trouble.names }, locale)
    : t('graph.look.thisScene');
  // "this scene" stands mid-sentence in some lines and opens others, so it is
  // written in lower case and a line that opens with it is capitalised -
  // "so This scene can't play" read as a mistake (2026-11-14).
  const said = t(SAID[trouble.reason], { name });
  const text = said.charAt(0).toLocaleUpperCase(locale) + said.slice(1);
  // Gone from the account is not something trying again can mend.
  const canRetry = trouble.reason !== 'gone';
  return (
    <div className="chart-scene-trouble" style={size}>
      <div className="chart-scene-trouble__card" role="alert">
        <SceneLookIcon
          className="chart-scene-trouble__icon"
          swatch={swatch}
          lookId={trouble.lookId}
        />
        <p className="chart-scene-trouble__text">{text}</p>
        {canRetry && (
          <>
            <p className="chart-scene-trouble__hint">
              {t('graph.look.reportHint', {
                help: t('help.menu'),
                report: t('app.menu.reportProblem'),
              })}
            </p>
            <button
              type="button"
              className="button small"
              onClick={() => onRetry(trouble.lookId)}
            >
              {t('graph.look.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
