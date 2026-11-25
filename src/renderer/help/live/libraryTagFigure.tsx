/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { DEFAULT_FIX_RULES } from 'common/library/tagFix';
import type { ITagFolderFacts, TTagFieldKey } from 'common/library/tagFields';
import MenuIcon from '../../icons/MenuIcon';
import {
  LibraryTagAlbumField,
  LibraryTagAlbumTitle,
} from '../../library/tags/LibraryTagAlbumFields';
import LibraryTagFileNames from '../../library/tags/LibraryTagFileNames';
import LibraryTagSetCover from '../../library/tags/LibraryTagSetCover';
import LibraryTagSetTools from '../../library/tags/LibraryTagSetTools';
import LibraryTagSheet from '../../library/tags/LibraryTagSheet';
import { proposalsFor, withFixes } from '../../library/tags/fixToSet';
import { pendingChangesOf } from '../../library/tags/tagChanges';
import type { IDraftCover } from '../../library/tags/tagDrafts';
import { fileRenamesOf, exampleNameOf } from '../../library/tags/tagFileNames';
import { groupsOf } from '../../library/tags/tagGroups';
import { FIELD_LABEL_KEYS } from '../../library/tags/tagLabels';
import {
  changedFields,
  initialSetState,
  summarise,
} from '../../library/tags/tagSetModel';
import { useTranslation } from '../../utils/I18nContext';
import { PICTURE_COVERS } from '../../components/featureTour/playerPictureData';
import { LibraryShell } from './libraryFigures';
import { HELP_TAG_SHEETS, HELP_TAG_TRACKS } from './libraryFigureData';
import TagChangesPanel from './libraryTagChanges';

/**
 * The Library chapter's tag editor (`helpChapters/listen.ts`): an untagged
 * album as Fix tags leaves it, in the editor's own parts — the album's
 * cover, its name typed over the big title, its fields, the songs' tools and
 * their sheet are the editor's components, fed the made-up folder
 * (`libraryFigureData`) and the state Fix's own rules work out from it
 * (`proposalsFor`, `withFixes`), the folder's picture taken as the cover and
 * the files renamed by their tags. The page's head, Back and its foot read
 * the editor's context, which acts, so they are its markup
 * (`LibraryTagSetEditor`); the changes beside it are `libraryTagChanges`.
 */

const nothing = () => undefined;

/** Beside the cover, and folded under More fields, as the editor has them. */
const MAIN_FIELDS: readonly TTagFieldKey[] = ['albumArtist', 'year', 'genre'];

const MORE_FIELDS: readonly TTagFieldKey[] = [
  'artist',
  'trackTotal',
  'discNo',
  'publisher',
  'composer',
  'comment',
];

/** The pattern the files are renamed by: the first one offered. */
const FILE_NAMES = '{track} - {title}';

/** The folder's picture, as Fix takes `folder.jpg` for an album with none. */
const FOLDER_PICTURE: IDraftCover = {
  id: 'help-folder-picture',
  bytes: new Uint8Array(0),
  mime: 'image/jpeg',
  url: PICTURE_COVERS.paperMoons,
  width: 600,
  height: 600,
};

/**
 * Fix tags' work on the made-up folder, by Fix's own default rules (never
 * the reader's, `readFixRules`), worked out once.
 */
const FIXED = (() => {
  const sheets = HELP_TAG_SHEETS;
  const ids = sheets.map((sheet) => sheet.trackId);
  const groups = groupsOf(sheets, false);
  const lines = proposalsFor(
    groups[0]?.sheets ?? sheets,
    DEFAULT_FIX_RULES,
    new Map<string, ITagFolderFacts>(),
  );
  const state = {
    ...withFixes(initialSetState(ids), sheets, lines, true),
    cover: FOLDER_PICTURE,
    fileNames: FILE_NAMES,
  };
  const changes = changedFields(state, sheets);
  const renames = fileRenamesOf(state, sheets);
  return {
    sheets,
    groups,
    state,
    renames,
    summary: summarise(state, sheets, changes, renames),
    pending: pendingChangesOf(state, sheets, changes, renames),
  };
})();

const WandGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="M2.5 13.5 10.5 5.5M9.5 2.5v2M12.5 3.5l-1.4 1.4M13.5 6.5h-2M7 2.8l.6.9" />
  </svg>
);

/** The album page, as `LibraryTagSetEditor` draws it after Fix. */
const TagSetPage = () => {
  const { t } = useTranslation();
  const { sheets, groups, state, renames, summary } = FIXED;
  const moreLabel = MORE_FIELDS.map((key) => t(FIELD_LABEL_KEYS[key])).join(
    ', ',
  );
  return (
    <section className="library-tags-set" aria-label="Paper Moons">
      <div className="library-tags-set__scroll">
        <div className="library-tags-set__top">
          <button
            type="button"
            className="button small subtle library-tags-back"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
            {t('library.tags.set.back')}
          </button>
          <button
            type="button"
            className="button small subtle library-tags-set__web"
          >
            <MenuIcon name="external" />
            {t('library.tags.set.searchWeb')}
          </button>
          <button
            type="button"
            className="button small subtle library-tags-set__fix"
          >
            <WandGlyph />
            {t('library.tags.set.fixAuto')}
          </button>
        </div>
        <p className="library-tags-set__fixed" role="status">
          <WandGlyph />
          <span>{t('library.tags.fix.filled')}</span>
        </p>
        <div className="library-tags-album">
          <LibraryTagSetCover
            sheets={sheets}
            tracks={HELP_TAG_TRACKS}
            cover={state.cover}
            onCover={nothing}
          />
          <div className="library-tags-album__side">
            <LibraryTagAlbumTitle
              fieldKey="album"
              sheets={sheets}
              state={state}
              onShared={nothing}
            />
            <div className="library-tags-album__facts">
              {MAIN_FIELDS.map((key) => (
                <LibraryTagAlbumField
                  key={key}
                  fieldKey={key}
                  sheets={sheets}
                  state={state}
                  onShared={nothing}
                />
              ))}
            </div>
            <details className="library-tags-album__more">
              <summary>
                {t('library.tags.set.moreFields', { fields: moreLabel })}
              </summary>
            </details>
          </div>
        </div>
        <LibraryTagSetTools
          groups={groups}
          ordered={sheets}
          finding={{ find: '', replace: '' }}
          onFinding={nothing}
          found={0}
          onState={nothing}
          fileNames={
            <LibraryTagFileNames
              pattern={state.fileNames}
              onPattern={nothing}
              renames={renames}
              exampleOf={(pattern) =>
                sheets[0] === undefined
                  ? undefined
                  : exampleNameOf(state, sheets[0], pattern)
              }
            />
          }
        />
        <LibraryTagSheet
          groups={groups}
          state={state}
          tracks={HELP_TAG_TRACKS}
          finding={{ find: '', replace: '' }}
          renames={renames}
          onCell={nothing}
          onMove={nothing}
        />
      </div>
      <footer className="library-tags-set__foot">
        <div className="library-tags-set__what">
          <b>{t('library.tags.set.changes', { count: summary.changeCount })}</b>
          <span>
            {t('library.tags.set.files', { count: summary.fileCount })}
          </span>
        </div>
        <div className="library-tags-set__actions">
          <button type="button" className="button small subtle">
            {t('library.tags.set.discard')}
          </button>
          <button type="button" className="button small">
            {t('library.tags.save')}
          </button>
        </div>
      </footer>
    </section>
  );
};

/** The Library with Paper Moons open in the tag editor after Fix tags. */
const LibraryTagsDrawing = () => (
  <LibraryShell
    browseMode="album"
    viewMode="grid"
    record={{ kind: 'album', name: 'Paper Moons' }}
    side={{
      kind: 'changes',
      pane: <TagChangesPanel changes={FIXED.pending} />,
    }}
    isRailFolded
    height={980}
  >
    <TagSetPage />
  </LibraryShell>
);

export default LibraryTagsDrawing;
