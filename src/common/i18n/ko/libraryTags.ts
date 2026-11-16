/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Library's tag editor. See `../en/libraryTags.ts`. */
const libraryTags = {
  'library.tags.menu.edit': '태그 편집…',
  'library.tags.menu.editMany': '{count}곡의 태그 편집…',
  'library.tags.menu.editAlbum': '앨범 태그 편집…',
  'library.tags.menu.cover': '커버 변경…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count}곡',
  'library.tags.selection.edit': '태그 편집',
  'library.tags.selection.clear': '선택 해제',

  'library.tags.field.title': '제목',
  'library.tags.field.artist': '아티스트',
  'library.tags.field.composer': '작곡가',
  'library.tags.field.album': '앨범',
  'library.tags.field.albumArtist': '앨범 아티스트',
  'library.tags.field.trackNo': '트랙',
  'library.tags.field.trackTotal': '전체 트랙 수',
  'library.tags.field.discNo': '디스크',
  'library.tags.field.discTotal': '전체 디스크 수',
  'library.tags.field.year': '연도',
  'library.tags.field.genre': '장르',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': '설명',
  'library.tags.field.grouping': '그룹',
  'library.tags.field.publisher': '레이블',
  'library.tags.field.copyright': '저작권',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': '지휘자',
  'library.tags.field.subtitle': '부제',
  'library.tags.field.remixer': '리믹스',
  'library.tags.field.initialKey': '조성',
  'library.tags.field.compilation': '컴필레이션',
  'library.tags.field.titleSort': '제목 정렬',
  'library.tags.field.artistSort': '아티스트 정렬',
  'library.tags.field.albumSort': '앨범 정렬',
  'library.tags.field.albumArtistSort': '앨범 아티스트 정렬',
  'library.tags.field.composerSort': '작곡가 정렬',
  'library.tags.field.musicBrainzTrackId': 'MusicBrainz 녹음',
  'library.tags.field.musicBrainzReleaseId': 'MusicBrainz 발매',
  'library.tags.field.musicBrainzArtistId': 'MusicBrainz 아티스트',
  'library.tags.field.musicBrainzReleaseArtistId': 'MusicBrainz 앨범 아티스트',
  'library.tags.field.musicBrainzReleaseGroupId': 'MusicBrainz 발매 그룹',

  'library.tags.panel.title': '태그 편집',
  'library.tags.panel.position': '{count}곡 중 {index}번째',
  'library.tags.panel.previous': '이전 곡(Alt+↑)',
  'library.tags.panel.next': '다음 곡(Alt+↓)',
  'library.tags.panel.close': '닫기(Esc): 편집 내용은 유지됩니다',
  'library.tags.panel.reading': '파일의 태그를 읽는 중…',
  'library.tags.panel.readFailed':
    '이 파일의 태그를 읽을 수 없습니다. 손상되었거나 사용 중일 수 있습니다.',
  'library.tags.panel.missing': '이 곡은 더 이상 디스크에 없습니다.',
  'library.tags.panel.unsupported':
    'FluidEQ는 이 종류의 파일 태그를 편집하지 않습니다.',
  'library.tags.group.song': '곡',
  'library.tags.group.album': '앨범',
  'library.tags.group.details': '세부 정보',
  'library.tags.group.file': '파일',
  'library.tags.of': '/',
  'library.tags.sameAsArtist': '아티스트와 같음',
  'library.tags.putBack': '되돌리기',
  'library.tags.noArtist': '아티스트 없음',
  'library.tags.noAlbum': '앨범 없음',
  'library.tags.genre.inLibrary': '내 라이브러리에 있음',
  'library.tags.tip.fileName':
    '제목이 파일 이름 그대로입니다. "{title}"(으)로 바꿀까요?',
  'library.tags.tip.fileNameTrack':
    '제목이 파일 이름 그대로입니다. "{title}", 트랙 {track}(으)로 바꿀까요?',
  'library.tags.tip.use': '사용',

  'library.tags.cover.dropHint': '이미지를 놓거나 붙여넣기',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': '이 파일에는 커버가 없습니다',
  'library.tags.cover.new': '새 커버 · {width} × {height}',
  'library.tags.cover.removed': '저장할 때 커버를 제거합니다',
  'library.tags.cover.refused': '20MB 이하의 JPEG 또는 PNG 이미지만 됩니다.',
  'library.tags.cover.emptyClipboard': '클립보드에 이미지가 없습니다.',

  'library.tags.more.toggle': '추가 필드',
  'library.tags.more.count': '이 파일에 {count}개 · 원하는 필드 추가 가능',
  'library.tags.more.countNone': '원하는 필드 추가 가능',
  'library.tags.more.add': '필드 추가',
  'library.tags.more.addHint': '형식이 허용하는 모든 필드를 코드로 추가합니다.',
  'library.tags.more.code': '코드',
  'library.tags.more.value': '값',
  'library.tags.more.addConfirm': '추가',
  'library.tags.more.badCode':
    '이 파일의 형식은 그 코드를 텍스트로 저장할 수 없습니다.',

  'library.tags.file.format': '형식',
  'library.tags.file.tags': '파일의 태그',
  'library.tags.file.noTags': '태그 없음',
  'library.tags.file.writeAs': '쓰기 형식',
  'library.tags.file.keep': '{version} 유지',
  'library.tags.file.v23Note':
    'v2.3은 Windows 파일 탐색기, 차량용 오디오, 오래된 플레이어가 가장 잘 읽습니다. v2.4는 UTF-8을 쓰고 필드마다 여러 값을 저장합니다.',
  'library.tags.file.v24Note':
    'Windows 파일 탐색기와 일부 차량용 오디오는 v2.4를 잘 읽지 못합니다. 이 파일을 다른 곳에서도 쓴다면 v2.3이 안전합니다.',
  'library.tags.file.id3v1': '예전 ID3v1 태그도 함께 갱신',
  'library.tags.file.readOnly':
    '이 파일은 읽기 전용입니다. 쓰기 전에 물어봅니다.',

  'library.tags.foot.none': '변경 사항 없음',
  'library.tags.foot.noneHint': '앨범을 넘겨 보는 동안 편집 내용이 유지됩니다',
  'library.tags.foot.changes': '저장하지 않은 변경 {count}개',
  'library.tags.foot.changesOne': '저장하지 않은 변경 1개',
  'library.tags.foot.inSongs': '{count}곡',
  'library.tags.foot.inSongsOne': '1곡',
  'library.tags.revert': '편집 취소',
  'library.tags.save': '저장',
  'library.tags.saveSongs': '{count}곡 저장',
  'library.tags.saveFailed':
    '입력한 그대로 쓸 수 없는 값이 있습니다. 표시된 필드를 확인하세요.',

  'library.tags.set.reading': '태그 읽는 중 · {done}/{count}',
  'library.tags.set.use': '"{value}" 사용',
  'library.tags.set.coversMixed': '서로 다른 커버 {count}개',
  'library.tags.set.coversNone': '커버 없는 곡 {count}개',
  'library.tags.set.coverOne': '모든 곡에 같은 커버',
  'library.tags.set.coverNoneAll': '커버가 있는 곡이 없습니다',
  'library.tags.set.coverToAll': '{count}곡 모두에 적용',
  'library.tags.set.songs': '곡',
  'library.tags.set.renumber': '순서대로 번호 다시 매기기',
  'library.tags.set.fixAuto': '자동으로 고치기',
  'library.tags.set.moreFields': '더 많은 항목 ({fields})',
  'library.tags.set.varies': '곡마다 다름:',
  'library.tags.set.variesPlaceholder': '곡마다 다름 · 모두에 쓸 값을 입력',
  'library.tags.set.useForAll': '{count}곡 모두에 사용',
  'library.tags.set.found': '{count}곡 찾음',
  'library.tags.set.foundOne': '1곡 찾음',
  'library.tags.set.foundNone': '해당하는 제목이 없습니다',
  'library.tags.cover.change': '커버 변경',
  'library.tags.cover.changeShort': '변경',
  'library.tags.cover.chooseImage': '이미지 선택…',
  'library.tags.cover.pasteImage': '클립보드에서 붙여넣기',
  'library.tags.cover.removeCover': '커버 제거',
  'library.tags.set.find': '제목에서 찾기',
  'library.tags.set.replaceWith': '바꿀 내용',
  'library.tags.set.replaceAll': '모두 바꾸기',
  'library.tags.set.sheetHint':
    'Enter는 아래로 · Tab은 오른쪽으로 · Ctrl+D는 위 칸 복사 · 행의 손잡이를 끌어 순서를 바꾼 뒤 번호를 다시 매기세요.',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': '길이',
  'library.tags.set.grip': '끌어서 순서 바꾸기',
  'library.tags.set.missingCell': '없음',
  'library.tags.set.groupSongs': '{count}곡',
  'library.tags.set.changes': '변경 {count}개',
  'library.tags.set.changesOne': '변경 1개',
  'library.tags.set.files': '파일 {count}개 · 아직 아무것도 쓰지 않음',
  'library.tags.set.filesOne': '파일 1개 · 아직 아무것도 쓰지 않음',
  'library.tags.set.discard': '버리기',
  'library.tags.set.back': '뒤로',
  'library.tags.set.leaveAsk': '이 변경 사항을 저장하지 않고 나갈까요?',
  'library.tags.set.keepEditing': '계속 편집',
  'library.tags.set.unreadable': '{count}곡은 읽을 수 없어 제외했습니다.',

  'library.tags.write.progress': '태그 쓰는 중 · {done}/{count}',
  'library.tags.write.undoing': '태그 되돌리는 중 · {done}/{count}',
  'library.tags.write.background': '백그라운드에서 계속',
  'library.tags.write.show': '보기',
  'library.tags.write.cancel': '취소',
  'library.tags.write.written': '{count}개 중 {done}개 씀',
  'library.tags.write.needYou': '{count}개는 확인이 필요합니다',
  'library.tags.write.review': '파일 {count}개 확인',
  'library.tags.write.reviewOne': '파일 1개 확인',
  'library.tags.write.done': '파일 {count}개 업데이트됨',
  'library.tags.write.doneOne': '파일 1개 업데이트됨',
  'library.tags.write.doneNote':
    '이전 태그는 보관됩니다. 실행 취소로 모두 되돌릴 수 있습니다.',
  'library.tags.write.undo': '실행 취소',
  'library.tags.write.undone': '실행 취소됨',
  'library.tags.write.undoneNote':
    '모든 파일이 커버까지 포함해 이전 태그로 돌아갔습니다.',
  'library.tags.write.stopped': '{count}개 중 {done}개에서 멈춤',
  'library.tags.write.stoppedNote':
    '이미 쓴 파일은 새 태그를 유지합니다. 실행 취소로 이전 태그로 되돌릴 수 있습니다.',
  'library.tags.write.failed': '{count}개를 쓰지 못했습니다',
  'library.tags.write.failedOne': '1개를 쓰지 못했습니다',
  'library.tags.write.dismiss': '닫기',
  'library.tags.problems.title': '파일 {count}개는 확인이 필요합니다',
  'library.tags.problems.titleOne': '파일 1개는 확인이 필요합니다',
  'library.tags.problems.allHandled': '모두 처리됨',
  'library.tags.problems.waiting': '{count}개는 곡이 끝나기를 기다리는 중',
  'library.tags.problems.waitingOne': '1개는 곡이 끝나기를 기다리는 중',
  'library.tags.problems.held':
    'FluidEQ에서 재생 중입니다. 곡이 끝나는 즉시 씁니다.',
  'library.tags.problems.locked':
    '다른 프로그램에서 열려 있습니다. 그쪽에서 닫은 뒤 다시 시도하세요.',
  'library.tags.problems.readOnly':
    '이 파일은 읽기 전용이라 지금 상태로는 바꿀 수 없습니다.',
  'library.tags.problems.failed':
    '이 파일을 쓰지 못했습니다. 파일은 그대로이며 잃은 것은 없습니다.',
  'library.tags.problems.missing':
    '이 파일은 라이브러리가 찾았던 위치에 더 이상 없습니다.',
  'library.tags.problems.retry': '다시 시도',
  'library.tags.problems.skip': '건너뛰기',
  'library.tags.problems.makeWritable': '쓰기 가능하게 하고 쓰기',
  'library.tags.problems.skipAll': '모두 건너뛰기',
  'library.tags.problems.nothingToDo': '할 일이 없습니다.',
  'library.tags.problems.everythingElse': '나머지는 모두 썼습니다',
  'library.tags.problems.undoCovers': '실행 취소는 이 파일에도 적용됩니다',
  'library.tags.menu.fix': '태그 자동 수정…',
  'library.tags.menu.fixAlbum': '이 앨범 수정…',
  'library.tags.menu.fixShortcut': 'Ctrl+Shift+I',
  'library.tags.hero.fix': '태그 수정',
  'library.tags.selection.fix': '수정',
  'library.tags.fix.empty': '비어 있음',
  'library.tags.fix.albums': '앨범 {count}개',
  'library.tags.fix.albumChanges': '변경 {count}개',
  'library.tags.fix.albumChangesOne': '변경 1개',
  'library.tags.fix.nothingFound':
    'FluidEQ가 이 곡들에서 고칠 것을 찾지 못했습니다.',
  'library.tags.fix.noPicture': '앨범 폴더의 이미지를 사용할 수 없습니다.',
  'library.tags.fix.filled':
    'FluidEQ가 빠진 정보를 채웠습니다. 바뀐 값은 색으로, 이전 값은 옆에 취소선으로 표시됩니다. 확인 후 저장하거나 취소하세요.',
  'library.tags.fix.fixAlbum': '고치기',
  'library.tags.fix.openAlbum': '열기',
  'library.tags.fix.editByHand': '모두 직접 편집',
  'library.tags.fix.albumComplete': '완료',
  'library.tags.changes.title': '변경 사항',
  'library.tags.changes.none':
    '아직 변경 사항이 없습니다. 바꾼 내용은 저장하기 전에 여기에 표시됩니다.',
  'library.tags.changes.album': '앨범 전체',
  'library.tags.changes.songs': '곡별',
  'library.tags.changes.removed': '삭제됨',
  'library.tags.changes.cover': '커버',
  'library.tags.changes.coverNew': '새 이미지',
  'library.tags.changes.coverRemoved': '삭제됨',
  'library.tags.cover.useOne': '하나를 모든 곡에 사용',
  'library.tags.cover.useThis': '이 커버를 모든 곡에 사용',
  'library.tags.write.undoAsk': '{count}개 파일의 이전 태그를 되돌릴까요?',
  'library.tags.write.undoAskOne': '파일 1개의 이전 태그를 되돌릴까요?',
  'library.tags.write.undoKeep': '아니요',
  'library.tags.write.undoConfirm': '되돌리기',
};

export default libraryTags;
