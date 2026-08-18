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

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'ローカルカラオケ',
  'karaoke.title': 'あなたの音楽のためのステージ',
  'karaoke.intro':
    'このワークスペースでは、曲、同期歌詞、マイクモニタリング、ピッチガイドをPC上でローカルにまとめます。',
  'karaoke.fullscreen.enter': '全画面表示',
  'karaoke.fullscreen.exit': '全画面を終了',
  'karaoke.fullscreen.hideHeader': 'FluidEQ ヘッダーを隠す',
  'karaoke.fullscreen.showHeader': 'FluidEQ ヘッダーを表示',
  'karaoke.actions': 'カラオケ操作',
  'karaoke.readiness.resize': 'マイクとピッチパネルのサイズを変更',
  'karaoke.empty.title': 'ステージの準備ができました',
  'karaoke.empty.body':
    '音声と任意の歌詞を開くか、フォルダー全体を追加します。FluidEQ は同名ファイルをプレイリストで関連付けます。',
  'karaoke.import.pending': '次へ：曲をインポート',
  'karaoke.import.open': '曲を開く',
  'karaoke.import.replace': '曲を入れ替える',
  'karaoke.import.addFiles': 'ファイルを追加',
  'karaoke.import.folder': 'フォルダーを追加',
  'karaoke.import.clear': '削除',
  'karaoke.import.loading': '曲を準備しています…',
  'karaoke.import.formats':
    '音声: MP3、WAV、OGG、FLAC、M4A · 歌詞: LRC、eLRC、UltraStar TXT',
  'karaoke.import.drop': '曲、歌詞、フォルダーをここにドロップ',
  'karaoke.error.missingAudio':
    'その歌詞ファイルと一緒に音声ファイルを追加してください。',
  'karaoke.error.ambiguous':
    '複数の組み合わせが考えられます。音声を1つ、必要なら歌詞を1つ選択してください。',
  'karaoke.error.unsupported':
    '選択したファイルには、現在対応している Karaoke の音声または歌詞がありません。',
  'karaoke.error.read': '選択したローカルファイルを読み込めませんでした。',
  'karaoke.error.playback':
    'この Chromium ビルドでは、その音声ファイルまたはコーデックを再生できません。',
  'karaoke.warning.lyrics':
    'を解析できなかったため、音声のみを歌詞なしで利用できます。',
  'karaoke.song.unknownArtist': 'ローカル曲',
  'karaoke.playlist.title': 'プレイリスト',
  'karaoke.playlist.groupFolders': 'フォルダーごとにグループ化',
  'karaoke.playlist.looseFiles': '未分類のファイル',
  'karaoke.playlist.resize': 'プレイリストとステージのサイズを変更',
  'karaoke.playlist.collapse': 'プレイリストを折りたたむ',
  'karaoke.playlist.expand': 'プレイリストを展開',
  'karaoke.playlist.select': '{title} を選択',
  'karaoke.playlist.moveUp': '{title} を上へ移動',
  'karaoke.playlist.moveDown': '{title} を下へ移動',
  'karaoke.playlist.remove': '{title} を削除',
  'karaoke.source.audioOnly': '音声のみ',
  'karaoke.source.lrc': 'LRC · 行タイミング',
  'karaoke.source.elrc': 'eLRC · 単語タイミング',
  'karaoke.source.ultrastar': 'UltraStar · 音節 + 音程',
  'karaoke.lyrics.none':
    '同期歌詞が選択されていません。再生とライブチューナーは利用できます。',
  'karaoke.lyrics.line': '歌詞行 {number}',
  'karaoke.lyrics.previous': '前の歌詞',
  'karaoke.lyrics.next': '次の歌詞',
  'karaoke.lyrics.follow': '歌詞を追従',
  'karaoke.lyrics.textSize': '歌詞の文字サイズ',
  'karaoke.transport.title': 'Karaoke 再生コントロール',
  'karaoke.transport.restart': '曲を最初から再生',
  'karaoke.transport.play': '再生',
  'karaoke.transport.pause': '一時停止',
  'karaoke.transport.spaceShortcut': '{action} · スペース',
  'karaoke.transport.seek': '曲の位置',
  'karaoke.transport.volume': '音量',
  'karaoke.transport.vocalLevel': 'ガイドボーカル',
  'karaoke.transport.vocalOff': '伴奏のみ',
  'karaoke.transport.vocalFull': '原曲',
  'karaoke.transport.mixSettings': 'ミックス設定',
  'karaoke.transport.openMixSettings': '{channel}のミックス設定を開く',
  'karaoke.mic.title': 'マイク',
  'karaoke.mic.settings': 'マイク設定',
  'karaoke.mic.off': 'オフ',
  'karaoke.mic.hint':
    '入力を選択してください。FluidEQはオンにしたときだけマイクへのアクセスを求めます。',
  'karaoke.mic.select': 'マイク入力',
  'karaoke.mic.default': 'システムの既定',
  'karaoke.mic.unnamed': 'マイク {number}',
  'karaoke.mic.turnOn': 'マイクをオン',
  'karaoke.mic.turnOff': 'マイクをオフ',
  'karaoke.mic.requesting': '接続中…',
  'karaoke.mic.live': '使用中',
  'karaoke.mic.denied': 'アクセスが拒否されました',
  'karaoke.mic.unavailable': 'マイクがありません',
  'karaoke.mic.disconnected': '切断されました',
  'karaoke.mic.error': '開始できませんでした',
  'karaoke.mic.level': 'マイク入力レベル',
  'karaoke.mic.levelValue': 'マイク入力レベル：{percent}%',
  'karaoke.mic.privacy':
    'レベルとピッチはPC内だけで解析します。FluidEQはマイクを録音せず、スピーカーから再生しません。',
  'karaoke.mic.volume': 'マイク音量',
  'karaoke.mic.volumeValue': 'マイク音量：{percent}%',
  'karaoke.pitch.title': 'ピッチレーン',
  'karaoke.pitch.resize': 'ピッチレーンのサイズを変更',
  'karaoke.pitch.show': 'ピッチガイドを表示',
  'karaoke.pitch.hide': 'ピッチガイドを非表示',
  'karaoke.pitch.guide': 'メロディーガイド',
  'karaoke.pitch.toneGuide': 'メロディー音',
  'karaoke.pitch.toneEnable': 'メロディー音を再生',
  'karaoke.pitch.toneDisable': 'メロディー音を停止',
  'karaoke.pitch.toneVolume': 'メロディー音の音量',
  'karaoke.pitch.scrubHint':
    '左右にドラッグして曲内を移動します。離すと一時停止したままになります。',
  'karaoke.pitch.viewSelector': 'ピッチ表示',
  'karaoke.pitch.viewNotes': 'ノート',
  'karaoke.pitch.viewWave': 'カーブ',
  'karaoke.pitch.waveCanvas':
    '曲のノート上に表示する歌声のリアルタイム音程カーブ',
  'karaoke.pitch.waveSong': '曲の音程',
  'karaoke.pitch.waveVoice': 'あなたの声',
  'karaoke.pitch.waveFooter':
    '青いブロックが曲のノートで、細いリアルタイム曲線がマイクから検出した音程です。',
  'karaoke.pitch.review': 'パフォーマンスレビュー',
  'karaoke.pitch.reviewCount': '練習する箇所: {count}',
  'karaoke.pitch.issueHigh':
    '{time} の音程が高すぎます。この部分を練習しましょう。',
  'karaoke.pitch.issueLow':
    '{time} の音程が低すぎます。この部分を練習しましょう。',
  'karaoke.pitch.issueMissed':
    '{time} の音符を歌えていません。この部分を練習しましょう。',
  'karaoke.practice.go': 'スタート',
  'karaoke.practice.ready': 'もう一度歌う準備をしてください',
  'karaoke.countIn.ready': '準備してください —「GO」の後に曲が始まります',
  'karaoke.pitch.canvas': 'マイクのリアルタイム音程と目標音程のレーン',
  'karaoke.pitch.micOff': 'マイクをオンにすると音程を確認できます。',
  'karaoke.pitch.loading': '音程解析を開始しています…',
  'karaoke.pitch.unavailable':
    '音程解析を利用できません。マイクレベルは引き続き動作します。',
  'karaoke.pitch.noSignal': 'マイクに向かって歌うと音程が描画されます。',
  'karaoke.pitch.empty':
    '目標音程は、インポートした曲に実際に含まれている場合だけ表示されます。',
  'karaoke.pitch.high': '高い',
  'karaoke.pitch.tuned': '音程一致',
  'karaoke.pitch.low': '低い',
  'karaoke.pitch.ultrastar':
    '青いバーが目標音程です。軌跡は声が高い、合っている、低いのどれかを示します。',
  'karaoke.chords.aria': '伴奏音源から推定したギターコード',
  'karaoke.chords.analyzing': 'コードを解析中… {percent}%',
  'karaoke.chords.estimate': '推定コード',
  'karaoke.chords.next': '次',
  'karaoke.chords.in': '{seconds}秒後',
  'karaoke.chords.none': '安定したコードが見つかりません',
  'karaoke.chords.confidence': '音声推定の信頼度：{percent}%',
  'karaoke.maker.open': '作成',
  'karaoke.maker.openTitle': 'このカラオケを作成または編集',
  'karaoke.maker.dialog': 'カラオケメーカー',
  'karaoke.maker.eyebrow': 'FLUIDEQ カラオケメーカー',
  'karaoke.maker.close': 'メーカーを閉じる',
  'karaoke.maker.songTitle': '曲名',
  'karaoke.maker.untitled': '無題のカラオケ',
  'karaoke.maker.undo': '元に戻す',
  'karaoke.maker.redo': 'やり直す',
  'karaoke.maker.preview': 'プレビュー · 1、2、3',
  'karaoke.maker.apply': 'プレーヤーで使用',
  'karaoke.maker.applyHint':
    'この編集をプレイヤーで使用します。元のカラオケファイルは変更されず、エクスポートで新しいファイルを作成します。',
  'karaoke.maker.lyrics': '歌詞',
  'karaoke.maker.toolsEdit': '編集ツール',
  'karaoke.maker.toolsAnalysis': '解析ツール',
  'karaoke.maker.lyricsTiming': '歌詞タイミング',
  'karaoke.maker.timingAll': '曲全体',
  'karaoke.maker.timingFromWord': '選択した歌詞から',
  'karaoke.maker.timingAllHint':
    '同期済みのすべての歌詞と音符をまとめて移動します。',
  'karaoke.maker.timingFromWordHint':
    '「{word}」以降を移動します。それ以前のタイミングは固定されます。',
  'karaoke.maker.earlier': '歌詞全体を早める',
  'karaoke.maker.later': '歌詞全体を遅らせる',
  'karaoke.maker.openProject': 'カラオケを読み込む',
  'karaoke.maker.projectLoaded':
    'プロジェクトを読み込みました。現在の音声は接続されたままです。',
  'karaoke.maker.karaokeImported':
    'タイミングを読み込みました。現在の音声は接続されたままです。',
  'karaoke.maker.tapWords': '歌詞をタップ',
  'karaoke.maker.recordLines': '行の開始位置を記録',
  'karaoke.maker.syncLinesFromHere': 'ここから行を同期',
  'karaoke.maker.syncWordsFromHere': 'ここから単語を同期',
  'karaoke.maker.syncNow': '現在',
  'karaoke.maker.syncNext': '次: {item}',
  'karaoke.maker.markLine': '行の開始をマーク',
  'karaoke.maker.markLineEnd': '行の終了をマーク',
  'karaoke.maker.captureEnd': '終了位置を待機中',
  'karaoke.maker.capturePressStart': '手順 1 · 開始時に Enter',
  'karaoke.maker.captureReplaceStart':
    '次の歌詞を表示中 · Enter で開始位置を置換',
  'karaoke.maker.captureStartSaved': '{time} に開始を保存 · 終了時に Enter',
  'karaoke.maker.captureAutomaticStart': '自動開始 {time} · 終了時に Enter',
  'karaoke.maker.captureAutomaticSuggestion':
    '開始候補 {time} · Enter で開始を記録',
  'karaoke.maker.captureFixEnd': '記録済み行 · Enter で終了を修正',
  'karaoke.maker.captureStartPoint': '開始',
  'karaoke.maker.captureEndPoint': '終了',
  'karaoke.maker.captureGuideTitle': '行タイミング',
  'karaoke.maker.captureSetupTitle': '歌詞のタイミングを記録しますか？',
  'karaoke.maker.captureSetupBody':
    '歌声を聴き、行の開始で Enter、新しい単語ごとに必要なら Tab、行の終了でもう一度 Enter を押します。最後の長い単語も正しい長さで残せます。',
  'karaoke.maker.captureSetupStatus':
    'ライブプレビューのガイドを確認してから記録を開始してください。',
  'karaoke.maker.captureStartRecording': '記録を開始',
  'karaoke.maker.captureMoveGuide':
    'ドラッグしてガイドを移動します。ダブルクリックで位置をリセットします。',
  'karaoke.maker.selectionPanel': '選択ツール',
  'karaoke.maker.selectionMoveGuide':
    'ドラッグして選択ツールを移動します。ダブルクリックで位置をリセットします。',
  'karaoke.maker.dismissSelection': '選択ツールを閉じる',
  'karaoke.maker.captureCountdownReady': '最初の行に備えてください',
  'karaoke.maker.captureGuideNext': '次の行',
  'karaoke.maker.captureGuideAudio': '音声を2秒移動 · Shift：1秒',
  'karaoke.maker.captureGuideLyrics': '歌詞行を選択',
  'karaoke.maker.captureGuidePlayback': '再生または一時停止',
  'karaoke.maker.captureGuideWords': '次の単語を記録',
  'karaoke.maker.captureGuideUndo': '最後のマークを元に戻す',
  'karaoke.maker.stopRecording': '記録を停止',
  'karaoke.maker.markWord': '単語をマーク',
  'karaoke.maker.markNextWord': '次の単語',
  'karaoke.maker.done': '完了',
  'karaoke.maker.ignoreLine': '行を無視',
  'karaoke.maker.lineTimingComplete':
    '歌詞行のタイミングが完了しました。確認してプレーヤーで使用できます。',
  'karaoke.maker.recordLinesHint':
    'ENTER で開始/終了 · ↑/↓ で歌詞行を選択 · ←/→ は音声だけを2秒移動 · SPACE で再生/一時停止 · Backspace で元に戻す',
  'karaoke.maker.panView': '手のひら · タイムライン移動',
  'karaoke.maker.panHint':
    '手のひらツール：キャンバスをドラッグして、編集せずに曲内を移動します。',
  'karaoke.maker.scrubHint':
    '再生ヘッドをクリックまたはドラッグして曲内を移動します。',
  'karaoke.maker.addNote': 'ノート',
  'karaoke.maker.selectNotes': '音符を選択',
  'karaoke.maker.paintNotes': '音符を描画',
  'karaoke.maker.selectNotesHint':
    '音符を囲むようにドラッグします。選択した音符をドラッグするとグループが移動します。Ctrl を押しながら単語または音節へドラッグすると関連付けられます。',
  'karaoke.maker.paintNotesHint':
    '音高グリッド上をドラッグして音符を描きます。ツールは有効なままなので続けて追加できます。',
  'karaoke.maker.notesSelected': '個の音符を選択中',
  'karaoke.maker.copyNotes': '選択した音符をコピー',
  'karaoke.maker.pasteNotes': '再生ヘッドに音符を貼り付け',
  'karaoke.maker.notePasted': '再生ヘッドに音符を貼り付けました。',
  'karaoke.maker.notesPasted':
    '再生ヘッドに {count} 個の音符を貼り付けました。',
  'karaoke.maker.attachNotesByTime': '歌詞に関連付け',
  'karaoke.maker.detachNotes': '歌詞との関連付けを解除',
  'karaoke.maker.noteAttachHelp':
    'Ctrl を押しながら音符を単語または音節へドラッグします。関連付けた音符は歌詞のタイミングに従いロックされます。',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C で選択をコピー · Ctrl+V で先頭の音符を再生ヘッドに貼り付けます。',
  'karaoke.maker.attachedTo': '「{word}」に関連付け済み',
  'karaoke.maker.noteUnattached': '歌詞に関連付けられていません',
  'karaoke.maker.splitWordSyllables': '単語を音節に分割',
  'karaoke.maker.syllableEditorEyebrow': '音節エディター',
  'karaoke.maker.syllableEditorTitle': '「{word}」を分割',
  'karaoke.maker.syllableEditorHint':
    '文字の間をクリックして音節の区切りを追加または削除します。',
  'karaoke.maker.syllableSplitPoint': '「{text}」の後の区切りを切り替え',
  'karaoke.maker.syllableEditorPreview': '分割後の音節',
  'karaoke.maker.applySyllableSplit': '音節分割を適用',
  'karaoke.maker.hearNote': 'ノートを聴く',
  'karaoke.maker.split': '分割',
  'karaoke.maker.delete': '削除',
  'karaoke.maker.analyze': 'メロディーを解析',
  'karaoke.maker.prepare': 'カラオケを準備',
  'karaoke.maker.advanced': '詳細',
  'karaoke.maker.prepared':
    'このカラオケには同期済みのメロディーノートがあります。',
  'karaoke.maker.repairLyrics': '歌詞タイミングを再検出',
  'karaoke.maker.repairMelody': 'メロディーノートを再検出',
  'karaoke.maker.rebuildKaraoke': '歌詞とメロディーを再構築',
  'karaoke.maker.autoAlign': '自動整列',
  'karaoke.maker.aiMelody': 'AI メロディー',
  'karaoke.maker.transcribe': '文字起こし',
  'karaoke.maker.vocalStem': 'ボーカルステムを使用',
  'karaoke.maker.vocalStemLoaded': 'ボーカルステム読み込み済み',
  'karaoke.maker.groupVoice': '歌声と伴奏',
  'karaoke.maker.stemsTitle': '分離したトラック',
  'karaoke.maker.stemBacking': '伴奏',
  'karaoke.maker.stemVoice': '歌声',
  'karaoke.maker.stemSave': '保存',
  'karaoke.maker.groupLyrics': '歌詞とタイミング',
  'karaoke.maker.removeBackground': '歌声と伴奏を分離',
  'karaoke.maker.removeBackgroundDone': '歌声は分離済み',
  'karaoke.maker.separationDownloading':
    '分離モデルをダウンロード中（{percent}%）· 初回のみ、約700MB',
  'karaoke.maker.separationReading': '曲を読み込み中',
  'karaoke.maker.separating': '歌声と伴奏を分離しています',
  'karaoke.maker.separationDone': '歌声を分離しました。歌詞検出が使えます。',
  'karaoke.maker.separationSlow':
    'このパソコンにはグラフィック処理の高速化がないため、1分未満ではなく数分かかります。',
  'karaoke.maker.separationRequired':
    '先に歌声を分離してください。歌詞検出は分離したボーカルを読み取ります。',
  'karaoke.maker.wizardTitle': 'この曲を自動で準備する',
  'karaoke.maker.wizardIntro':
    'この曲にはまだ歌詞のタイミングがありません。FluidEQ は歌声を伴奏から分離し、そこから歌詞とタイミングを読み取れます。すべてこのパソコン上で実行されます。',
  'karaoke.maker.wizardStepSeparate': '歌声を分離',
  'karaoke.maker.wizardStepTranscribe': '歌詞とタイミングを読み取り',
  'karaoke.maker.wizardLanguage': '歌詞の言語',
  'karaoke.maker.wizardLanguageAuto': '自動判定',
  'karaoke.maker.wizardStart': '自動で準備',
  'karaoke.maker.wizardSkip': '自分で行う',
  'karaoke.maker.wizardCancel': '停止',
  'karaoke.maker.wizardHide': 'バックグラウンドで続行',
  'karaoke.maker.wizardCancelled':
    '停止しました。完了した分は保持されています。',
  'karaoke.maker.vocalFocus': '中央ボーカルを強調',
  'karaoke.maker.export': '書き出す',
  'karaoke.maker.exportProject': 'FluidEQ プロジェクト',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': '拡張 LRC',
  'karaoke.maker.exportInstrumental': '伴奏トラック（歌声なし）',
  'karaoke.maker.tapHint':
    '「{word}」でスペースまたは Enter · Backspace で元に戻す',
  'karaoke.maker.editHint':
    'ノートをドラッグして音高/時間を変更。端をドラッグして長さを変更。Ctrl + ホイールでズーム。',
  'karaoke.maker.stats': '{notes} ノート · {words} 語 · {checks} チェック',
  'karaoke.maker.wordStateLegend': '歌詞タイミングの作業状況',
  'karaoke.maker.userAdjustedWords': '{count} 語を調整済み',
  'karaoke.maker.pendingWords': '{count} 語が未処理',
  'karaoke.maker.artist': 'アーティスト',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'ズーム',
  'karaoke.maker.songPosition': '曲内の位置',
  'karaoke.maker.previousView': '前の区間',
  'karaoke.maker.nextView': '次の区間',
  'karaoke.maker.resetZoom': 'ダブルクリックで歌詞全体を表示',
  'karaoke.maker.livePreview': 'ライブプレビュー',
  'karaoke.maker.showPreview': 'プレビューを表示',
  'karaoke.maker.hidePreview': 'プレビューを隠す',
  'karaoke.maker.previewEmpty':
    'タイミング付き歌詞を追加または整列してプレビューします。',
  'karaoke.maker.noteNormal': 'ノート',
  'karaoke.maker.noteGolden': 'ゴールデン',
  'karaoke.maker.noteFree': 'フリー',
  'karaoke.maker.untimed': 'タイミングなし',
  'karaoke.maker.applyUntimed':
    '{count} 個の歌詞単語に、検証済みの音声タイミングがまだありません。プレーヤーで使用する前に検出または配置してください。',
  'karaoke.maker.selectHint':
    '歌詞またはメロディーノートを選択して確認します。',
  'karaoke.maker.rights': 'この音声と歌詞を使用・書き出す許可を持っています。',
  'karaoke.maker.cancel': 'キャンセル',
  'karaoke.maker.localAnalysis': 'ローカル解析',
  'karaoke.maker.lyricsEyebrow': '歌詞',
  'karaoke.maker.lyricsTitle': '1 行ごとに歌詞を貼り付けまたは編集',
  'karaoke.maker.lyricsWarning':
    'テキストを置き換えると、安全に再同期できるよう単語リンクが消去されます。',
  'karaoke.maker.lyricsReferenceHint':
    '[Verse] や [Chorus] などのマーカーと繰り返し行を含む完全な歌詞を入力してください。FluidEQ はこのテキストを保持し、ローカル音声認識でタイミングを検出します。',
  'karaoke.maker.referenceLyrics': '参照歌詞',
  'karaoke.maker.wordTiming': '単語タイミング',
  'karaoke.maker.lyricsWordCount': '参照歌詞は {count} 語',
  'karaoke.maker.lyricsTimedCount': '{total} 語中 {timed} 語を設定済み',
  'karaoke.maker.lyricsApplyBeforeTiming':
    '単語タイミングを編集する前に新しい歌詞を検出してください',
  'karaoke.maker.lyricsNoTimedWords': 'タイミング設定済みの単語はありません',
  'karaoke.maker.lyricsTimingEditorHint':
    '検出後、任意の単語を選択してテキスト、開始時刻、長さを修正できます。',
  'karaoke.maker.lyricsSelectWord':
    'タイミングを編集する単語を選択してください。',
  'karaoke.maker.lyricsSelectedWord': '選択した単語',
  'karaoke.maker.lyricsWordNavigation': '単語ナビゲーション',
  'karaoke.maker.previousWord': '前の単語',
  'karaoke.maker.nextWord': '次の単語',
  'karaoke.maker.lyricsPlaceholder':
    '完全な歌詞をここに貼り付け…\n\n[Verse]\n1 行目\n2 行目',
  'karaoke.maker.loadLyricsFile': '歌詞ファイルを読み込む',
  'karaoke.maker.lyricsFileLoaded': '{file} から歌詞を読み込みました。',
  'karaoke.maker.lyricsRequired':
    'タイミングとメロディーを検出する前に完全な歌詞を追加してください。',
  'karaoke.maker.detectTimingMelody': 'タイミングとメロディーを検出',
  'karaoke.maker.acceptLyrics': '歌詞を適用',
  'karaoke.maker.acceptAndRecordLines': '適用して時間を記録',
  'karaoke.maker.continueInBackground': 'バックグラウンドで続行',
  'karaoke.maker.clearLyrics': '歌詞を消去',
  'karaoke.maker.clearLyricsTitle': 'すべての歌詞を消去しますか？',
  'karaoke.maker.clearLyricsBody':
    'すべての歌詞とタイミングを削除します。メロディーノートは残りますが、単語とのリンクは解除されます。消去後も元に戻せます。',
  'karaoke.maker.clearNotes': 'ノートを消去',
  'karaoke.maker.clearNotesTitle': 'すべてのメロディーノートを消去しますか？',
  'karaoke.maker.clearNotesBody':
    '歌詞と単語タイミングを残したまま、すべてのメロディーノートを削除します。消去後も元に戻せます。',
  'karaoke.maker.notesCleared': 'すべてのメロディーノートを消去しました。',
  'karaoke.maker.lyricsCleared':
    'すべての歌詞を消去しました。既存のノートは単語リンクなしで保持されました。',
  'karaoke.maker.restore': '元に復元',
  'karaoke.maker.restoreTitle': '元のカラオケに復元しますか？',
  'karaoke.maker.restoreBody':
    'このセッションの編集をすべて破棄し、保存された下書きも含めて、読み込んだときの状態にカラオケを組み直します。復元後も元に戻せます。',
  'karaoke.maker.restored': '読み込んだ元の状態に復元しました。',
  'karaoke.maker.replaceLyricsWarning':
    '単語が変更されています。置換すると単語 ID と自動タイミングが再構築され、既存の手動修正は確実に移行できません。ノートは保持され再リンクされます。',
  'karaoke.maker.replaceAndDetect': '置換して検出',
  'karaoke.maker.wordText': '単語',
  'karaoke.maker.wordStart': '開始（ms）',
  'karaoke.maker.wordPosition': '位置',
  'karaoke.maker.wordDuration': '長さ（ms）',
  'karaoke.maker.wordTimingSliderHint':
    '共有境界を調整します。行全体の範囲を固定したまま、隣の単語との時間を受け渡します。',
  'karaoke.maker.usePlayhead': '再生位置を使用',
  'karaoke.maker.playWord': '単語を再生',
  'karaoke.maker.allowAutoTiming': '自動タイミングを許可',
  'karaoke.maker.replaceLyrics': '歌詞を置き換える',
  'karaoke.maker.lyricsAutoAligned':
    '新しい歌詞を適用し、利用可能なメロディーに揃えました。',
  'karaoke.maker.lyricsNeedPreparation':
    '新しい歌詞を適用しました。「カラオケを準備」でタイミングを検出してください。',
  'karaoke.maker.transcriptionEyebrow': '任意のローカル文字起こし',
  'karaoke.maker.transcriptionTitle':
    'ローカル音声モデルをダウンロードしますか？',
  'karaoke.maker.transcriptionBody':
    'FluidEQ は MIT ライセンスの {model} モデルを Hugging Face からダウンロードしてこの PC に保存します（歌声分離用に約 700 MB、初回のみ）。音声がこのパソコンから出ることはありません。初回は数分かかり、メモリを多く使います。',
  'karaoke.maker.transcriptionReview':
    '認識結果は出発点です。既存歌詞との照合では元の表記を保持し、すべての時刻を編集できます。',
  'karaoke.maker.notNow': '今はしない',
  'karaoke.maker.downloadTranscribe': 'ダウンロードして文字起こし',
  'karaoke.maker.downloadPrepare': 'ダウンロードして歌詞を準備',
  'karaoke.maker.downloadingWhisper': 'Whisper モデルをダウンロード中',
  'karaoke.maker.downloadOverall': '全体のダウンロード',
  'karaoke.maker.downloadFiles': '{total} ファイル中 {complete} 完了',
  'karaoke.maker.loadingWhisper': 'Whisper モデルを読み込み中',
  'karaoke.maker.analysisRunning': 'ピッチをローカルで解析中',
  'karaoke.maker.analysisAligned':
    '未編集の歌詞を検出された {count} 個の音符領域に合わせました。手動タイミングは保持されています。',
  'karaoke.maker.analysisFound':
    '解析で {count} 個の音符領域が見つかりました。',
  'karaoke.maker.basicPitchRunning': 'メロディーの音符を検出中',
  'karaoke.maker.basicPitchFound':
    '歌声から編集可能な音符を{count}個検出しました。',
  'karaoke.maker.whisperPreparing': 'Whisper を準備中',
  'karaoke.maker.whisperDecoding': '音声をローカルでデコード中',
  'karaoke.maker.whisperTranscribing': 'ローカルで文字起こし中',
  'karaoke.maker.whisperTranscribingProgress':
    '歌詞タイミングを検出中 · パス {pass}/{passes} · ブロック {chunk}/{chunks}',
  'karaoke.maker.whisperComplete': '文字起こし完了',
  'karaoke.maker.whisperMatched':
    'Whisper が認識した {count} 語を対応付けました。エクスポート前に編集可能なタイミングを確認してください。',
  'karaoke.maker.autoAlignComplete':
    '未編集の歌詞を検出されたメロディーに合わせました。手動タイミングは保持されています。',
  'karaoke.maker.speechMemory': 'AIモデルのメモリ',
  'karaoke.maker.speechMemoryReady': 'RAM で準備完了',
  'karaoke.maker.speechMemoryCached': 'ディスクにキャッシュ済み',
  'karaoke.maker.speechMemoryMissing': '未ダウンロード',
  'karaoke.maker.freeMemory': '今すぐ RAM を解放',
  'karaoke.maker.memoryReleased':
    '音声モデルを RAM から解放しました。ダウンロード済みファイルはキャッシュに残ります。',
  'karaoke.maker.memoryReleaseBusy':
    '音声モデルは使用中のため、まだ解放できません。',
  'karaoke.maker.memoryAfterUse': 'アイドル時',
  'karaoke.maker.memoryPolicy.ask': '確認する',
  'karaoke.maker.memoryPolicy.auto': '自動的に解放',
  'karaoke.maker.memoryPolicy.keep': '読み込み状態を維持',
  'karaoke.maker.memoryAfter': '経過時間',
  'karaoke.maker.memoryMinutes': '{count} 分',
  'karaoke.maker.memoryPromptTitle': '音声モデルのメモリを解放しますか？',
  'karaoke.maker.memoryPromptBody':
    'ローカル音声モデルはアイドル状態です。解放すると RAM を節約でき、ファイルは高速な再読み込みのためキャッシュに残ります。',
  'karaoke.maker.keepLoaded': '読み込み状態を維持',
  'karaoke.maker.exported': '{file} をエクスポートしました',
  'karaoke.maker.exportFallback': 'カラオケファイル',
  'karaoke.maker.projectTooLarge': 'プロジェクトが 16 MB を超えています。',
  'karaoke.maker.previewResize': 'ライブプレビューのサイズを変更',
  'karaoke.maker.seekBack': '{seconds} 秒戻る',
  'karaoke.maker.seekForward': '{seconds} 秒進む',
  'karaoke.maker.jumpToStart': '曲の先頭へ移動',
  'karaoke.maker.jumpToEnd': '曲の末尾へ移動',
  'karaoke.maker.errorAudioLimits':
    'ローカル解析は 1 GB 以下の音声ファイルと 30 分未満の録音に対応しています。',
  'karaoke.maker.errorComponentUnavailable':
    'ローカル解析に必要なコンポーネントを利用できません。FluidEQ を再起動して再試行してください。',
  'karaoke.maker.errorAnalysis':
    'FluidEQ はこの音声をローカルで解析できませんでした。',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar のエクスポートにはメロディー音符が少なくとも 1 つ必要です。',
  'karaoke.maker.errorExport':
    'FluidEQ はこのカラオケをエクスポートできませんでした。',
  'karaoke.maker.errorProjectVersion':
    'このプロジェクトは未対応の FluidEQ バージョンで作成されています。',
  'karaoke.maker.errorImport':
    'FluidEQ はこのカラオケまたはプロジェクトを読み込めませんでした。',
  'karaoke.maker.errorParse':
    '選択した歌詞またはカラオケファイルを解析できませんでした。',
  'karaoke.maker.downloadFailed': 'Whisper モデルのダウンロードに失敗しました',
  'karaoke.maker.localAnalysisFailed': 'ローカル解析に失敗しました',
  'karaoke.maker.whisperDownloadError':
    'Hugging Face からモデルをダウンロードできませんでした。接続またはファイアウォールを確認して再試行してください。',
  'karaoke.maker.tryAgain': '再試行',
  'karaoke.maker.dismiss': 'エラーを閉じる',
  'karaoke.maker.analysisSource':
    '「{file}」をローカル解析元としてのみ使用します。',
  'karaoke.maker.rightsRequired':
    '書き出しを公開する前に音声と歌詞の権利を確認してください。',
  'karaoke.maker.draftRestored': '下書きを復元しました',
  'karaoke.maker.playerTimingLoaded':
    'プレイヤーの現在のタイミングを使用しています。元に戻すと保存済みの下書きを復元します。',
};

export default karaoke;
