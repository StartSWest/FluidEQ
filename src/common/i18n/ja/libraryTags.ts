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
  'library.tags.menu.edit': 'タグを編集…',
  'library.tags.menu.editMany': '{count} 曲のタグを編集…',
  'library.tags.menu.editAlbum': 'アルバムのタグを編集…',
  'library.tags.menu.cover': 'ジャケットを変更…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} 曲',
  'library.tags.selection.edit': 'タグを編集',
  'library.tags.selection.clear': '選択を解除',

  'library.tags.field.title': 'タイトル',
  'library.tags.field.artist': 'アーティスト',
  'library.tags.field.composer': '作曲者',
  'library.tags.field.album': 'アルバム',
  'library.tags.field.albumArtist': 'アルバムアーティスト',
  'library.tags.field.trackNo': 'トラック',
  'library.tags.field.trackTotal': 'トラック数',
  'library.tags.field.discNo': 'ディスク',
  'library.tags.field.discTotal': 'ディスク数',
  'library.tags.field.year': '年',
  'library.tags.field.genre': 'ジャンル',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'コメント',
  'library.tags.field.grouping': 'グループ',
  'library.tags.field.publisher': 'レーベル',
  'library.tags.field.copyright': '著作権',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': '指揮者',
  'library.tags.field.subtitle': 'サブタイトル',
  'library.tags.field.remixer': 'リミックス',
  'library.tags.field.initialKey': 'キー',
  'library.tags.field.compilation': 'コンピレーション',
  'library.tags.field.titleSort': 'タイトルの読み',
  'library.tags.field.artistSort': 'アーティストの読み',
  'library.tags.field.albumSort': 'アルバムの読み',
  'library.tags.field.albumArtistSort': 'アルバムアーティストの読み',
  'library.tags.field.composerSort': '作曲者の読み',
  'library.tags.field.musicBrainzTrackId': 'MusicBrainz の録音',
  'library.tags.field.musicBrainzReleaseId': 'MusicBrainz のリリース',
  'library.tags.field.musicBrainzArtistId': 'MusicBrainz のアーティスト',
  'library.tags.field.musicBrainzReleaseArtistId':
    'MusicBrainz のアルバムアーティスト',
  'library.tags.field.musicBrainzReleaseGroupId':
    'MusicBrainz のリリースグループ',

  'library.tags.panel.title': 'タグを編集',
  'library.tags.panel.position': '{count} 曲中 {index} 曲目',
  'library.tags.panel.previous': '前の曲（Alt+↑）',
  'library.tags.panel.next': '次の曲（Alt+↓）',
  'library.tags.panel.close': '閉じる（Esc）：編集内容は残ります',
  'library.tags.panel.reading': 'ファイルのタグを読み込んでいます…',
  'library.tags.panel.readFailed':
    'このファイルのタグを読み込めませんでした。破損しているか、使用中の可能性があります。',
  'library.tags.panel.missing': 'この曲はもうディスクにありません。',
  'library.tags.panel.unsupported':
    'FluidEQ はこの種類のファイルのタグを編集しません。',
  'library.tags.group.song': '曲',
  'library.tags.group.album': 'アルバム',
  'library.tags.group.details': '詳細',
  'library.tags.group.file': 'ファイル',
  'library.tags.of': '/',
  'library.tags.sameAsArtist': 'アーティストと同じ',
  'library.tags.putBack': '元に戻す',
  'library.tags.noArtist': 'アーティストなし',
  'library.tags.noAlbum': 'アルバムなし',
  'library.tags.genre.inLibrary': 'ライブラリ内',
  'library.tags.tip.fileName':
    'タイトルがファイル名のままです。「{title}」にしますか？',
  'library.tags.tip.fileNameTrack':
    'タイトルがファイル名のままです。「{title}」、トラック {track} にしますか？',
  'library.tags.tip.use': '使う',

  'library.tags.cover.dropHint': '画像をドロップまたは貼り付け',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'このファイルにはジャケットがありません',
  'library.tags.cover.new': '新しいジャケット · {width} × {height}',
  'library.tags.cover.removed': '保存時にジャケットを削除',
  'library.tags.cover.replace': '置き換え',
  'library.tags.cover.choose': '選択…',
  'library.tags.cover.paste': '貼り付け',
  'library.tags.cover.remove': '削除',
  'library.tags.cover.refused': '20 MB までの JPEG または PNG 画像のみです。',
  'library.tags.cover.emptyClipboard': 'クリップボードに画像がありません。',

  'library.tags.more.toggle': 'その他のフィールド',
  'library.tags.more.count': 'このファイルに {count} 件 · 追加も可能',
  'library.tags.more.countNone': '追加も可能',
  'library.tags.more.add': 'フィールドを追加',
  'library.tags.more.addHint':
    '形式が許すフィールドなら何でも、コードで追加できます。',
  'library.tags.more.code': 'コード',
  'library.tags.more.value': '値',
  'library.tags.more.addConfirm': '追加',
  'library.tags.more.badCode':
    'このファイルの形式では、そのコードをテキストとして保存できません。',

  'library.tags.file.format': '形式',
  'library.tags.file.tags': 'ファイル内のタグ',
  'library.tags.file.noTags': 'タグなし',
  'library.tags.file.writeAs': '書き込み形式',
  'library.tags.file.keep': '{version} のまま',
  'library.tags.file.v23Note':
    'v2.3 は Windows のエクスプローラー、カーオーディオ、古いプレーヤーで最も確実に読めます。v2.4 は UTF-8 で、1 つのフィールドに複数の値を保存できます。',
  'library.tags.file.v24Note':
    'Windows のエクスプローラーや一部のカーオーディオは v2.4 をうまく読めません。このファイルを持ち出すなら v2.3 が安全です。',
  'library.tags.file.id3v1': '古い ID3v1 タグも合わせて更新',
  'library.tags.file.readOnly':
    'このファイルは読み取り専用です。書き込む前に確認します。',

  'library.tags.foot.none': '変更なし',
  'library.tags.foot.noneHint': 'アルバム内を移動しても編集内容は残ります',
  'library.tags.foot.changes': '未保存の変更 {count} 件',
  'library.tags.foot.changesOne': '未保存の変更 1 件',
  'library.tags.foot.inSongs': '{count} 曲',
  'library.tags.foot.inSongsOne': '1 曲',
  'library.tags.revert': '編集を取り消す',
  'library.tags.save': '保存',
  'library.tags.saveSongs': '{count} 曲を保存',
  'library.tags.saveFailed':
    '入力どおりに書き込めない値があります。印の付いたフィールドを確認してください。',

  'library.tags.set.album': 'アルバム',
  'library.tags.set.folder': 'フォルダー',
  'library.tags.set.selection': '選択した曲',
  'library.tags.set.reading': 'タグを読み込み中 · {done}/{count}',
  'library.tags.set.mixedNote':
    '「混在」のフィールドは、全曲用の値を入力または選択するまで各曲の値を保ちます。',
  'library.tags.set.mixed': '混在',
  'library.tags.set.values': '{count} 種類の値',
  'library.tags.set.pickFor': '{field} · {count} 曲すべてに 1 つ選ぶ',
  'library.tags.set.empty': '空欄',
  'library.tags.set.keepEach': '各曲の値をそのまま',
  'library.tags.set.use': '「{value}」を使う',
  'library.tags.set.toAll': '→ {count} 曲すべて',
  'library.tags.set.coversMixed': '{count} 種類のジャケット',
  'library.tags.set.coversNone': '{count} 曲はジャケットなし',
  'library.tags.set.coverOne': '全曲で同じジャケット',
  'library.tags.set.coverNoneAll': 'ジャケットのある曲はありません',
  'library.tags.set.coverToAll': '{count} 曲すべてに適用',
  'library.tags.set.version': 'タグのバージョン',
  'library.tags.set.versionKeep': '各ファイルのまま',
  'library.tags.set.versionAll23': 'すべて ID3v2.3',
  'library.tags.set.versionAll24': 'すべて ID3v2.4',
  'library.tags.set.versionCounts': 'ID3v2.3：{v3} · v2.4：{v4} · なし：{none}',
  'library.tags.set.songs': '曲',
  'library.tags.set.renumber': '並び順で番号を振り直す',
  'library.tags.set.fromFileNames': 'ファイル名からタイトル',
  'library.tags.set.fixCapitals': '大文字・小文字を修正',
  'library.tags.set.findReplace': '検索と置換',
  'library.tags.set.find': 'タイトル内を検索',
  'library.tags.set.replaceWith': '置換後',
  'library.tags.set.replaceAll': 'すべて置換',
  'library.tags.set.sheetHint':
    'Enter で下へ · Tab で右へ · Ctrl+D で上のセルをコピー · 行のつまみをドラッグして並べ替え、その後番号を振り直します。',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': '時間',
  'library.tags.set.col.file': 'ファイル名',
  'library.tags.set.grip': 'ドラッグして並べ替え',
  'library.tags.set.missingCell': '未入力',
  'library.tags.set.groupSongs': '{count} 曲',
  'library.tags.set.changes': '変更 {count} 件',
  'library.tags.set.changesOne': '変更 1 件',
  'library.tags.set.files': '{count} ファイル · まだ何も書き込んでいません',
  'library.tags.set.filesOne': '1 ファイル · まだ何も書き込んでいません',
  'library.tags.set.noChanges':
    '共通のフィールドに入力すると全曲を変更できます',
  'library.tags.set.discard': '破棄',
  'library.tags.set.saveTo': '{count} ファイルに保存',
  'library.tags.set.saveToOne': '1 ファイルに保存',
  'library.tags.set.back': '戻る',
  'library.tags.set.leaveAsk': 'これらの変更を保存せずに戻りますか？',
  'library.tags.set.keepEditing': '編集を続ける',
  'library.tags.set.selectionTitle': '{first}、{second} ほか {count} 曲',
  'library.tags.set.unreadable':
    '{count} 曲は読み込めなかったため、除外しています。',

  'library.tags.write.progress': 'タグを書き込み中 · {done}/{count}',
  'library.tags.write.undoing': 'タグを元に戻しています · {done}/{count}',
  'library.tags.write.background': 'バックグラウンドで続ける',
  'library.tags.write.show': '表示',
  'library.tags.write.cancel': 'キャンセル',
  'library.tags.write.written': '{count} 件中 {done} 件を書き込み済み',
  'library.tags.write.needYou': '{count} 件の確認が必要です',
  'library.tags.write.review': '{count} ファイルを確認',
  'library.tags.write.reviewOne': '1 ファイルを確認',
  'library.tags.write.done': '{count} ファイルを更新しました',
  'library.tags.write.doneOne': '1 ファイルを更新しました',
  'library.tags.write.doneNote':
    '以前のタグは保存されています。元に戻すですべて戻せます。',
  'library.tags.write.undo': '元に戻す',
  'library.tags.write.undone': '元に戻しました',
  'library.tags.write.undoneNote':
    'すべてのファイルが、ジャケットも含めて以前のタグに戻りました。',
  'library.tags.write.stopped': '{count} 件中 {done} 件で停止しました',
  'library.tags.write.stoppedNote':
    '書き込み済みのファイルは新しいタグのままです。元に戻すで以前のタグに戻せます。',
  'library.tags.write.failed': '{count} 件を書き込めませんでした',
  'library.tags.write.failedOne': '1 件を書き込めませんでした',
  'library.tags.write.dismiss': '閉じる',
  'library.tags.problems.title': '{count} ファイルの確認が必要です',
  'library.tags.problems.titleOne': '1 ファイルの確認が必要です',
  'library.tags.problems.allHandled': 'すべて対応済み',
  'library.tags.problems.waiting': '{count} 件が曲の終わりを待っています',
  'library.tags.problems.waitingOne': '1 件が曲の終わりを待っています',
  'library.tags.problems.held':
    'FluidEQ で再生中です。曲が終わり次第書き込みます。',
  'library.tags.problems.locked':
    '別のプログラムで開かれています。そちらで閉じてから再試行してください。',
  'library.tags.problems.readOnly':
    'このファイルは読み取り専用のため、このままでは変更できません。',
  'library.tags.problems.failed':
    'このファイルに書き込めませんでした。ファイルは元のままで、何も失われていません。',
  'library.tags.problems.missing':
    'このファイルは、ライブラリが見つけた場所にもうありません。',
  'library.tags.problems.retry': '再試行',
  'library.tags.problems.skip': 'スキップ',
  'library.tags.problems.makeWritable': '書き込み可能にして書き込む',
  'library.tags.problems.skipAll': 'すべてスキップ',
  'library.tags.problems.nothingToDo': '操作は不要です。',
  'library.tags.problems.everythingElse': 'ほかはすべて書き込み済み',
  'library.tags.problems.undoCovers': '元に戻すはこれらにも適用されます',
};

export default libraryTags;
