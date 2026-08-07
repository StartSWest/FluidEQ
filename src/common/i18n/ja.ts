/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Japanese. です・ます throughout, as desktop software normally is. */
const ja: Partial<Dictionary> = {
  'app.tagline': 'あなたの音を、どの機器でも、自動で。',
  'app.actions': 'FluidEQ の操作',
  'app.actions.title': 'オーディオ操作',
  'app.status.ready': 'Equalizer APO に接続済み',
  'app.status.checking': 'Equalizer APO を確認しています…',
  'app.status.error': 'Equalizer APO が応答しません',
  'app.menu.importEq': 'EQ 設定を読み込む…',
  'app.menu.importConvolution': 'インパルス応答を読み込む…',
  'app.menu.restartAudio': 'Windows オーディオを再起動',
  'app.menu.reconfigure': 'Equalizer APO を再設定',
  'app.menu.apoSettings': 'Equalizer APO の設定',
  'app.menu.support': 'プロジェクトを支援する',
  'whatsNew.eyebrow': 'リリースノート',
  'whatsNew.title': 'FluidEQ の新機能',
  'whatsNew.loading': 'リリースノートを読み込んでいます…',
  'whatsNew.missing':
    'このビルドにリリースノートが見つかりませんでした。GitHub にもあります。',
  'app.menu.whatsNew': '新機能',
  'app.menu.language': '言語',
  'app.window.minimize': '最小化',
  'app.window.maximize': '最大化',
  'app.window.restore': '元に戻す',
  'app.window.close': '閉じる',
  'app.window.minimizeApp': 'FluidEQ を最小化',
  'app.window.maximizeApp': 'FluidEQ を最大化',
  'app.window.restoreApp': 'FluidEQ を元に戻す',
  'app.window.closeApp': 'FluidEQ を閉じる',
  'app.dismiss': '閉じる',

  'tabs.aria': 'サウンド作業領域',
  'tabs.eq': 'EQ とドライバー種別',
  'tabs.voicing': '音の傾向',
  'tabs.convolution': 'コンボリューション',
  'tabs.config': 'Config',
  'tabs.video': '動画',

  'graph.resize': 'ドラッグしてグラフの大きさを変更',
  'video.sites': '動画サイト',
  'video.back': '戻る',
  'video.forward': '進む',
  'video.reload': '再読み込み',
  'video.stop': '中止',
  'video.searchAria': '現在のサイト内を検索',
  'video.searchOn': '{site} で検索',
  'video.searchGo': '検索',
  'video.searchClear': '検索内容を消去',
  'video.searchRecent': '最近の検索',
  'video.searchForget': '「{term}」を削除',
  'video.searchForgetAll': '最近の検索を消去',
  'video.adBlock': '広告をブロック',
  'video.adBlockHint': 'YouTube の動画広告をスキップし、広告枠を隠します。',
  'video.blockedTitle': 'このリンクはプレーヤーの外に出ます',
  'video.blockedSignInTitle': 'ログインはここではなくブラウザーで行います',
  'video.openInBrowser': 'ブラウザで開く',
  'video.resize': 'ドラッグしてプレーヤーの大きさを変更',

  'notice.apoReconfigured':
    'Equalizer APO がインストールまたは再設定されました。音が出ない場合は PC を再起動せず、Windows オーディオを再起動してください。',
  'notice.restartNow': 'いますぐオーディオを再起動',
  'notice.importComplete': '読み込みが完了しました',
  'notice.restartConfirm':
    '音が数秒とまり、Windows が管理者権限を求めます。続けますか？',
  'update.title': 'FluidEQ の更新',
  'update.available':
    'バージョン {version} が利用できます。ダウンロード中です。',
  'update.downloading': '更新をダウンロード中… {percent}%',
  'update.ready':
    'バージョン {version} の準備ができました。FluidEQ を再起動すると適用されます。',
  'update.restart': '今すぐ再起動',
  'update.restarting': '再起動中…',
  'notice.restartDone':
    'Windows オーディオを再起動しました。まだ無音のアプリは開き直してください。',

  'sidebar.engine': '処理',
  'sidebar.systemEq': 'システム EQ',
  'sidebar.preamp': 'プリアンプ',
  'sidebar.preampAria': 'プリアンプゲイン（dB）',
  'sidebar.preampAuto':
    '自動で設定されます。自分で決めるには自動ノーマライズをオフにしてください。',
  'sidebar.headroom': 'APO ヘッドルーム',
  'sidebar.autoPreamp': '自動ノーマライズ',
  'sidebar.visualizer': 'ビジュアライザー',
  'sidebar.graphView': '周波数特性',

  'output.eyebrow': '出力に追従します',
  'output.title': '自動プロファイル',
  'output.device': '出力デバイス',
  'output.active': '使用中',
  'output.none': '有効な出力が見つかりません',
  'output.mapping': '自動割り当て',
  'output.mapping.neutral': '無処理の出力',
  'output.mapping.live': '現在の調整を割り当て済み',
  'output.mapping.hint':
    'EQ をどれか動かすと、この出力に自動で保存・割り当てされます。',
  'output.hint':
    'FluidEQ はデバイスの固定 ID を記録するため、Windows がその機器を選ぶたびにこの音が付いてきます。',

  'driver.eyebrow': '何で聴いているか',
  'driver.title': 'ドライバー種別',
  'driver.none': '補正なし',
  'driver.none.hint': '自分のバンドと音の傾向だけ',
  'driver.strength': '強さ',
  'driver.range': '±1.5 dB',

  'profiles.eyebrow': 'あなたの音',
  'profiles.title': '保存したプロファイル',
  'profiles.name': 'プロファイル名',
  'profiles.nameAria': 'プロファイル名',
  'profiles.new': '新規プロファイル',
  'profiles.newAria': '現在の EQ から新しいプロファイルを作る',
  'profiles.untitled': '無題のプロファイル',
  'profiles.save': '新規保存',
  'profiles.update': '更新',
  'profiles.saveAria': '設定をプロファイルに保存',
  'profiles.restore': '復元',
  'profiles.restoring': '復元中…',
  'profiles.restoreAria': 'このプロファイルを手動保存した最後の状態に戻す',
  'profiles.attached': '再生中',
  'profiles.attachedTitle': 'この出力で再生中',
  'profiles.detecting': '出力を検出しています…',
  'profiles.empty': 'まだプロファイルがありません。最初の音を作りましょう。',
  'profiles.error.empty': 'プロファイル名は空にできません。',
  'profiles.error.restricted': '使えない名前です。別の名前にしてください。',
  'profiles.error.duplicate': '同じ名前があります。別の名前にしてください。',
  'profiles.edit': 'プロファイル名を編集',

  'autoeq.eyebrow': 'リファレンスから始める',
  'autoeq.title': 'AutoEQ ライブラリ',
  'autoeq.selectSource': 'ソースを選択',
  'autoeq.applied': '適用中：{name}',
  'autoeq.notApplied': 'リファレンス未適用',
  'autoeq.source': '測定ソース',
  'autoeq.model': 'ヘッドホンの機種',
  'autoeq.target': '測定 / ターゲット',
  'autoeq.apply': 'この機種の EQ を適用',
  'autoeq.applying': '適用中…',
  'autoeq.applyAria': '選んだ機種の EQ を適用',
  'autoeq.checking': '公式データベースを確認しています…',
  'autoeq.updateAvailable': '更新があります（{count} 機種）',
  'autoeq.upToDate': '公式データベースは最新です — {count} 機種',
  'autoeq.updateUnknown': '更新を確認できません',
  'autoeq.update': 'データベースを更新',
  'autoeq.updating': '更新中…',
  'autoeq.updateAria': 'AutoEq データベースを更新',
  'autoeq.allDatabases': 'すべてのデータベース',
  'autoeq.allDatabases.hint':
    'AutoEq 公式と GadgetryTech をまとめて検索します。',
  'autoeq.pickDevice': 'まず機種を選んでください 🎧',
  'autoeq.noResponses': '対応する測定がありません 😞',
  'autoeq.pickResponse': '測定を選んでください！🔊',
  'autoeq.selectSourcePlaceholder': 'ソースを選択…',
  'autoeq.searchSources': 'ソースを検索…',
  'autoeq.noModel': '検索に一致する測定済み機種がありません。',
  'autoeq.searchModels': 'ブランドまたは機種名で検索…',
  'voicing.quickAria': '音の傾向：{name}',
  'voicing.quickNone': '音の傾向：なし',
  'voicing.quickTitle': '音の傾向は未適用です',
  'voicing.quickLabel': '音の傾向',
  'voicing.quickNoneHint': '自分の EQ バンドだけ',

  'eq.eyebrow': '微調整',
  'eq.title': 'パラメトリック EQ',
  'eq.smart': 'スマート EQ',
  'eq.smart.cancel': 'キャンセル',
  'eq.smart.aria': '再生中の出力からスマート EQ を作成',
  'eq.smart.cancelAria': 'スマート EQ の測定をキャンセル',
  'eq.smart.continuous': '連続',
  'eq.smart.continuousAria': '再生中もスマート EQ の測定と調整を続ける',
  'eq.smart.modeAria': 'スマート EQ の測定方法を選ぶ',
  'eq.smart.mode.once.note': '一度だけ測定して終了',
  'eq.smart.mode.detail': 'ディテール',
  'eq.smart.mode.detail.note': '山と谷を補正し、録音の個性は残す',
  'eq.smart.mode.balance': 'バランス',
  'eq.smart.mode.balance.note': '録音ごとの明るさや暖かさもそろえる',
  'eq.smart.mode.target': 'ターゲット',
  'eq.smart.mode.target.note': 'すべての録音を同じ音色バランスに',
  'eq.layers': '同時に適用中',
  'eq.layers.aria': 'この出力に効いているその他の処理',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '（変更あり）',
  'eq.layers.eq.bands': '{count} バンド',
  'eq.layers.convolution': 'コンボリューション',
  'eq.layers.voicing': '音の傾向',
  'eq.layers.driver': 'ドライバー',
  'eq.layers.disable': '{layer} を削除せずにオフにします',
  'eq.layers.enable': '{layer} をもう一度オンにします',
  'eq.layers.smart': 'スマート EQ',
  'eq.layers.smart.fullRange': '測定済み · 全帯域',
  'eq.layers.smart.range': '測定済み · {low}〜{high}',
  'eq.layers.remove': '{layer} のレイヤーを外す',
  'eq.layers.clearReference':
    'リファレンス機種と、それが作ったバンドを消します',
  'eq.layers.clearSmart':
    '測定した補正を外します。バンドとリファレンス機種はそのまま残ります。',
  'eq.clear': 'EQ をクリア',
  'eq.addBand': 'バンドを追加',
  'eq.addBandAria': 'EQ バンドを追加',
  'eq.quickLayouts': 'クイックレイアウト',
  'eq.bandCount': '{count} バンド',
  'eq.selected': '選択中のバンド',
  'eq.filter': 'フィルター',
  'eq.frequency': '周波数',
  'eq.gain': 'ゲイン',
  'eq.gainDisabled': 'ゲイン · 該当なし',
  'eq.quality': 'Q（尖鋭度）',
  'eq.delete': 'バンドを削除',
  'eq.deleteAria': '選択中の EQ バンドを削除',

  'convolution.eyebrow': 'APO インパルス応答',
  'convolution.title': 'コンボリューション ライブラリ',
  'convolution.intro':
    '検証済みの最小位相インパルス応答をダウンロードし、パラメトリック EQ の前段に適用します。下のグラフには両方の曲線が出ます。',
  'convolution.import': 'WAV を読み込む…',
  'convolution.importing': '読み込み中…',
  'convolution.applied': 'この出力に適用中',
  'convolution.clear': '外す',
  'convolution.search': 'ヘッドホンの機種を検索',
  'convolution.searchPlaceholder':
    '「Kraken」「HD 650」や測定元の名前で試してください',
  'convolution.notice':
    'ダウンロード可能なカタログは AutoEq が提供しています。Equalizer APO はインパルス応答が出力のサンプリング周波数と一致することを要求するため、48 kHz WAV として取り込みます。',
  'convolution.loading': '公式カタログを読み込んでいます…',
  'convolution.empty':
    '一致するインパルス応答がありません。機種名を短くしてみてください。',
  'convolution.source': '出典',
  'convolution.apply': 'ダウンロードして適用',
  'convolution.downloading': 'ダウンロード中…',
  'convolution.isApplied': '適用済み',
  'convolution.none':
    'コンボリューションは未読み込みです。EQ タブは完全に独立しています。',

  'voicing.eyebrow': 'ターゲットカーブ',
  'voicing.title': '音の傾向',
  'voicing.intro':
    'いま実際にやっていることに合わせて調整したターゲットです。どれもあなたのバンドの後ろに独立したレイヤーとして書かれるので、自分の調整は一切触られず、「なし」に戻せばそのまま元通りになります。',
  'voicing.none': 'なし',
  'voicing.none.hint': '自分の EQ バンドだけ。上に重ねるものはありません',
  'voicing.strength': '強さ',
  'voicing.off': 'オフ',
  'voicing.full': '最大',
  'voicing.inert': '強さ 0% では、この傾向は何もしません。',
  'voicing.headroom':
    '最大 +{peak} dB 増えます。自動ノーマライズが余裕を確保するので、プリアンプを手動で決めるのでなければオンのままにしてください。',

  'config.eyebrow': 'Equalizer APO の設定',
  'config.lede':
    'いま実際にディスクにある内容です。FluidEQ の意図ではありません。',
  'config.reload': '再読み込み',
  'config.reloadTitle': '設定をディスクから読み直します',
  'config.reading': '読み込み中…',
  'config.absent':
    'FluidEQ はこの Equalizer APO にまだ何も書き込んでいません。',
  'config.status.notIncluded':
    'Equalizer APO はこの設定を読み込んでいません。以下は何も適用されていません。',
  'config.status.engineOff':
    'FluidEQ のエンジンがオフです。この設定は出力を一つも指定していないため、Equalizer APO は何も適用しません。',
  'config.status.active': '有効 — Equalizer APO がこの設定を適用しています。',
  'config.outputsAria': 'Equalizer APO の設定にある出力',
  'config.filters.one': 'フィルター {count} 個',
  'config.filters.many': 'フィルター {count} 個',
  'config.impulse': 'インパルス応答',
  'config.playingNow': '再生中',
  'config.liveTitle': '連続 EQ がこの測定を更新し続けています',
  'config.layer.on': 'オン',
  'config.layer.off': 'オフ',
  'config.empty': '何も含まれていません。この出力はそのままです。',
  'config.file.missing': '見つかりません',
  'config.export': 'チェーンを書き出す',
  'config.import': 'チェーンを読み込む',
  'config.import.hint': '読み込みは再生中の出力に適用されます。',
  'config.file.yours': 'あなたの',
  'config.hint.custom': 'あなたのファイルです。上書きされません。',
  'config.hint.generated': '自動生成 — 次の変更で書き直されます。',
  'config.hint.saving':
    '保存するとファイルに書き込まれ、Equalizer APO が読み取ります。',
  'config.edit': '編集',
  'config.cancel': 'キャンセル',
  'config.save': '保存',

  'support.eyebrow': '完全に任意です',

  'support.petHint': 'スペースキーで跳ねさせられます',

  'support.game.hint': 'ピークが線に達したらリズムに合わせて押します',

  'support.game.howTo':
    'ビートに合わせてペットをタップするかスペースキーを押してください。続けると ×10 で何かが起こります。',

  'support.game.thanks':
    '少しでも楽しんでいただけたなら、アイデアや支援がこの先を作ります。',

  'support.game.noAudio': '何か再生するとビートがここに出ます',

  'support.game.listening': 'ビートを探しています…',

  'support.game.share': '共有',

  'support.game.shareEuphoria': 'ユーフォリアを共有',

  'support.game.shareTitle': 'スコアを共有',

  'support.game.shareUnlock':
    '×10 に到達すると、このカードはユーフォリアモードになります。スペクトラムもすべて。',

  'support.game.shareNote':
    'カードを保存して投稿に添付してください。これらのサービスはリンクから画像を取り込めません。',

  'support.game.shareSave': 'カードを保存',

  'support.game.shareCopyCard': 'カードをコピー',

  'support.game.shareCardCopied': 'コピーしました — 貼り付けてください',

  'support.game.shareCopy': 'テキストをコピー',

  'support.game.shareCopied': 'コピーしました',

  'support.game.shareLinkOnly':
    '共有されるのはリンクのみです。テキストはご自身で貼り付けてください',

  'support.game.euphoria': 'ユーフォリアモード',

  'support.game.euphoriaToggle': 'ユーフォリアモードのオン・オフ',

  'support.game.perfect': 'パーフェクト',

  'support.game.great': 'グレート',

  'support.game.good': 'グッド',

  'support.game.miss': 'ミス',
  'support.title': 'この仕事を支える',
  'support.close': '閉じる',
  'support.pitch':
    'FluidEQ は無料でオープンソースです。これからもそうです — 有料の壁は一切なく、何も追跡しません。あなたの環境で居場所を得られたなら、支援はこれを保守する時間と、同じ工房から次に生まれるアイデアに使われます。',
  'support.craft':
    'これは一人の手による仕事で、たっぷりの愛情と、常識外れなほどの細部へのこだわりで作られています。どのパネルも手描きで、何度も考え直しました。周波数特性が一瞬でどう見えるか、メニューがどう開くか、ノブをゆっくり動かしたときにどう反応するか、ボタンにどの言葉を置くか。既製の部品にテーマを被せただけの箇所はひとつもありません。',
  'support.card': 'カード / ウォレット',
  'support.card.hint':
    'Stripe による安全な決済です。ブラウザで開きます — アプリがカード情報を見ることはありません。',
  'support.coffee': 'コーヒーをおごる',
  'support.coffee.hint':
    'アカウント不要の一回きりの寄付です。クリックでブラウザが開きます。スマートフォンでコードを読み取ることもできます。',
  'support.verify': '送る前にアドレスを確認してください。',
  'support.copy': 'アドレスをコピー',
  'support.copied': 'コピーしました',
  'support.openWallet': 'ウォレットで開く',
  'support.contributed': '支援しました — 星とダンスを解除',
  'support.thanks': 'ありがとうございます — 相棒に星がつき、踊りはじめました。',
  'support.releaseNotes': 'このバージョンの新機能を見る',
  'support.footerBefore':
    '時間で貢献したいですか？ Issue や Pull Request も同じように歓迎です：',

  'language.title': '言語',
  'language.aria': '表示言語',
  'waveform.style': 'メーターのスタイルを変更',
};

export default ja;
