/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TSceneStanding } from 'common/sceneReviewStanding';
import type { IStudioLookCopy } from 'main/ipc/studioProjectTypes';
import Glyph from '../community/Glyph';
import MenuIcon from '../icons/MenuIcon';
import SceneReviewWhy from '../plus/SceneReviewWhy';
import { useTranslation } from '../utils/I18nContext';
import type { IVersionLine, TVersionLineMark } from './versionLine';
import '../styles/StudioVersionLine.scss';

interface IStudioVersionLineProps {
  /**
   * The sentence; `'asking'` while the gallery is asked, when the line keeps
   * its room; undefined when the scene has no version to speak of yet.
   */
  line: IVersionLine | 'asking' | undefined;
  /** The review's refusal, for "See why" when the line names one. */
  standing: TSceneStanding | undefined;
  /** The member's own copy in their looks, once they kept one. */
  look: IStudioLookCopy | undefined;
  /**
   * What the stage has to say when it is not simply playing the last save
   * (`studioBenchStatus`): the AI at work, a save that does not build.
   */
  stage: TranslationKey | undefined;
}

function Mark({ mark }: { mark: TVersionLineMark }) {
  switch (mark) {
    case 'live':
    case 'changed':
      return <span className={`studio-line__dot is-${mark}`} aria-hidden />;
    case 'off':
      return <span className="studio-line__ring" aria-hidden />;
    case 'review':
      return <MenuIcon name="pending" className="studio-line__icon" />;
    case 'refused':
      return <MenuIcon name="alert" className="studio-line__icon is-refused" />;
    default:
      return null;
  }
}

/**
 * Where the open scene stands, in one sentence beside the project (Ivan,
 * 2026-11-25, design C of the version-line mockups): what people have in the
 * gallery and what is on the bench, then the step after it where there is one
 * ("See why" for a refusal; Publish itself turns loud for unpublished
 * changes, `StudioShipCard`), the member's own copy in their looks, and the
 * stage's line only when the stage has news. While all is well the stage says
 * nothing: "Updated from your last save" and its lit dot read as something
 * new having arrived.
 *
 * The line keeps its room while the gallery is asked (`is-asking`), so the
 * sentence lands without moving the bar.
 */
export default function StudioVersionLine({
  line,
  standing,
  look,
  stage,
}: IStudioVersionLineProps) {
  const { t } = useTranslation();
  return (
    <div
      className="studio-line"
      role="group"
      aria-label={t('studio.version.group')}
    >
      {line === 'asking' && (
        <span className="studio-line__say is-asking" aria-busy="true" />
      )}
      {typeof line === 'object' && (
        <span className="studio-line__say">
          <Mark mark={line.mark} />
          <span className="studio-line__words">{t(line.key, line.vars)}</span>
        </span>
      )}
      {typeof line === 'object' &&
        line.seeWhy &&
        standing?.kind === 'rejected' && <SceneReviewWhy refusal={standing} />}
      {look && (
        <span
          className="studio-line__looks"
          title={t(
            look.current
              ? 'studio.version.looksCurrent'
              : 'studio.version.looksBehind',
            { version: look.version },
          )}
        >
          <Glyph name="looks" />
          {look.current ? (
            <>
              {t('studio.line.inLooks')}
              <Glyph name="check" className="studio-line__check" />
            </>
          ) : (
            t('studio.line.looksOlder')
          )}
        </span>
      )}
      {stage && (
        <span className={`studio-bench__status is-${stage.split('.').pop()}`}>
          <span className="studio-bench__lamp" aria-hidden="true" />
          {t(stage)}
        </span>
      )}
    </div>
  );
}
