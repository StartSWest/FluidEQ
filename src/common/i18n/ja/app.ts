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

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
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
  'app.menu.fix': '修復',
  'app.menu.reportProblem': '問題を報告',
  'app.menu.about': '{product} について…',
  'app.processes.menu': 'プロセス…',
  'app.processes.eyebrow': 'プロセス',
  'app.processes.hint':
    'これらはすべて同じプログラムなので、Windows はどれもアプリ名で表示します。ここでは各プロセスが FluidEQ のために実際に何をしているかを示します。',
  'app.processes.hintSplit':
    '分かれているのは意図的です。画面、描画、音がそれぞれ独立して動くので、ウィンドウが忙しくても音楽は止まらず、どこか一つの不具合が全体を巻き込むこともありません。',
  'app.processes.process': 'プロセス',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'メモリ',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': 'このウィンドウ',
  'app.processes.total': '合計 {megabytes} MB。',
  'app.processes.unmeasured': 'ダッシュはまだ計測されていない値です。',
  'app.processes.name.window': '画面',
  'app.processes.what.window':
    'いま見ているウィンドウです。カーブ、ライブラリ、プレーヤー、すべての操作部。ウィンドウごとに 1 プロセスなので、重い再描画が音を止めることはありません。',
  'app.processes.name.core': 'アプリ本体',
  'app.processes.what.core':
    'ウィンドウを持たない部分です。設定を保持し、オーディオデバイスとシステムのイコライザーとやり取りし、更新を確認し、この一覧のほかのプロセスを起動します。',
  'app.processes.name.engine': 'オーディオエンジン (C++)',
  'app.processes.what.engine':
    'FluidEQ 自前のエンジンです。再生するものをデコードし、そのままイコライザーを適用します。別のプログラムなので、Windows はほかとは離れた場所に表示します。',
  'app.processes.name.graphics': 'グラフィックス',
  'app.processes.what.graphics':
    'ウィンドウをグラフィックスカードで描きます。スペクトラム、カーブ、あらゆるアニメーション。画面で何かが動いていれば動作します。カラオケやノイズのモデルはここでは動きません。',
  'app.processes.name.sound': 'ブラウザーの音',
  'app.processes.what.sound':
    'Chromium 自身の音声で、動画タブやページが鳴らす音に使われます。あなたの音楽はここを通りません。',
  'app.processes.name.network': 'ネットワーク',
  'app.processes.what.network':
    '更新の確認、ジャケット画像、動画タブが読み込むすべて。この一覧のほかのプロセスはネットワークに触れません。',
  'app.processes.name.camera': 'カメラサービス',
  'app.processes.what.camera':
    'アプリが Windows にオーディオデバイスの一覧を求めると Chromium が起動します。同じ呼び出しがカメラも列挙するためで、カメラは開いていません。',
  'app.processes.name.page': 'ウェブページ',
  'app.processes.what.page':
    '動画タブで開いているページです。画面とは別の、独自のプロセスで動きます。',
  'app.processes.name.helper': '補助サービス',
  'app.processes.what.helper':
    '必要に応じて起動する Chromium のサービスです。FluidEQ が名前を指定して求めることはありません。',
  'app.menu.reinstallApp': '{product} を再インストール…',
  'app.menu.fixAudio': 'オーディオの問題を修復…',
  'app.menu.reinstallApo': 'Equalizer APO を再インストール…',
  'whatsNew.eyebrow': 'リリースノート',
  'whatsNew.title': 'FluidEQ の新機能',
  'whatsNew.loading': 'リリースノートを読み込んでいます…',
  'whatsNew.missing':
    'このビルドにリリースノートが見つかりませんでした。GitHub にもあります。',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': '新機能',
  'app.menu.language': '言語',
  'app.window.minimize': '最小化',
  'app.window.maximize': '最大化',
  'app.window.restore': '元に戻す',
  'app.window.close': '閉じる',
  'app.tray.open': '{product} を開く',
  'app.tray.quit': '{product} を終了',
  'app.tray.tooltip': '{product} — 実行中です',
  'app.tray.installUpdate': 'アップデートをインストールして再起動',
  'app.tray.checkForUpdates': 'アップデートを確認',
  'app.tray.tooltip.updateReady':
    '{product} — アップデートをインストールできます',
  'app.notification.updateReady.title': 'FluidEQ のアップデートが利用可能です',
  'app.notification.updateReady.body':
    'バージョン {version} をインストールできます。クリックして FluidEQ を再起動します。',
  'app.notification.updateReady.bodyNoVersion':
    'アップデートをインストールできます。クリックして FluidEQ を再起動します。',
  'app.notification.upToDate.title': 'FluidEQ は最新です',
  'app.notification.upToDate.body': 'すでに最新のバージョンです。',
  'app.notification.updateFound.title':
    'FluidEQ のアップデートが見つかりました',
  'app.notification.updateFound.body':
    'バージョン {version} をダウンロードしています。インストールできるようになったらお知らせします。',
  'app.notification.checkFailed.title': 'アップデートを確認できませんでした',
  'app.notification.checkFailed.body':
    'アップデートサーバーに接続できませんでした。FluidEQ が後でもう一度試します。',
  'app.notification.installFailed.title':
    'アップデートをインストールできませんでした',
  'app.notification.installFailed.body':
    'FluidEQ はインストーラーを起動できませんでした。クリックして FluidEQ を開き、もう一度お試しください。',
  'app.window.minimizeApp': 'FluidEQ を最小化',
  'app.window.maximizeApp': 'FluidEQ を最大化',
  'app.window.restoreApp': 'FluidEQ を元に戻す',
  'app.window.closeApp': 'FluidEQ を閉じる',
  'app.media.previous': '前のトラック',
  'app.media.playPause': '再生または一時停止',
  'app.media.next': '次のトラック',
  'app.media.previousAria': 'このパソコンで再生中のものを前のトラックへ',
  'app.media.playPauseAria': 'このパソコンで再生中のものを再生または一時停止',
  'app.media.nextAria': 'このパソコンで再生中のものを次のトラックへ',
  'app.dismiss': '閉じる',
  'common.search': '検索…',
  'common.recentSearches': '最近の検索',
  'common.clearRecentSearches': '最近の検索を消去',
  'common.clearSearch': '検索を消去',
  'common.noMatches': '一致なし',
  'common.filterOptions': '選択肢を絞り込む',
  'common.increase': '{item}を上げる',
  'common.decrease': '{item}を下げる',
  'common.icon.edit': '編集',
  'common.icon.delete': '削除',
  'common.icon.trash': '取り除く',
  'common.icon.accept': '確定',
  'common.icon.cancel': 'キャンセル',
  'tabs.aria': 'サウンド作業領域',
  'tabs.eq': 'EQ',
  'tabs.eqMain': 'バンド',
  'tabs.presets': 'EQ プリセット',
  'tabs.voicing': '音の傾向',
  'tabs.convolution': 'コンボリューション',
  'tabs.config': 'Config',
  'tabs.media': 'オンラインメディア',
  'tabs.mediaShort': 'メディア',
  'tabs.karaoke': 'カラオケ',
  'tabs.scrollBack': 'タブを前へスクロール',
  'tabs.scrollForward': 'タブを後へスクロール',
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
  'update.mandatory.title': 'このバージョンは更新が必要です',
  'update.mandatory.body':
    'このリリースは、FluidEQ を現状のまま使い続けるべきではないほど重大な問題を修正しています。更新を取得しています。',
  'update.mandatory.notOptional':
    'これは任意の更新ではありません。この通知を閉じて作業を終わらせても構いませんが、FluidEQ を更新するまで繰り返し表示されます。',
  'update.mandatory.later': '後で',
  'update.mandatory.waiting': '更新を取得しています…',
  'update.mandatory.readyPrompt':
    '更新のダウンロードが終わりました。インストール中は FluidEQ が終了し、そのあと自動的に開き直します。',
  'update.mandatory.install': 'インストールして再起動',
  'update.mandatory.installing': 'インストール中…',
  'update.mandatory.failedDownload':
    '更新をダウンロードできませんでした。ダウンロードサーバーに接続できなかったか、途中で通信が途切れた可能性があります。',
  'update.mandatory.failedInstall':
    '更新はダウンロードできましたが、インストーラーが起動しませんでした。Windows に拒否されたか、ダウンロードしたファイルが壊れている可能性があります。',
  'update.mandatory.manual':
    '手動でインストールすることもできます。リリースページから最新版をダウンロードして実行してください。設定とプロファイルはそのまま残ります。',
  'update.mandatory.releasePage': 'ダウンロードページを開く',
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
  'config.eyebrow': 'エンジンが実際に読むもの',
  'config.title': 'Equalizer APO の設定',
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
  'config.layers.noFile': '専用ファイルなし',
  'config.layers.inFile':
    '専用ファイルではなく、このファイルに書き込まれます。',
  'config.empty': '何も含まれていません。この出力はそのままです。',
  'config.file.missing': '見つかりません',
  'config.export': 'チェーンを書き出す',
  'config.import': 'チェーンを読み込む',
  'config.import.hint': '読み込みは再生中の出力に適用されます。',
  'config.import.customSkipped':
    '送信者自身のファイルは読み込みませんでした。中の Include: 行や Plugin: 行は Windows のオーディオにコードを読み込ませます。',
  'config.file.yours': 'あなたの',
  'config.hint.custom': 'あなたのファイルです。上書きされません。',
  'config.hint.generated': '自動生成 — 次の変更で書き直されます。',
  'config.hint.saving':
    '保存するとファイルに書き込まれ、Equalizer APO が読み取ります。',
  'config.edit': '編集',
  'config.cancel': 'キャンセル',
  'config.save': '保存',
  'disclaimer.heading': '保証はなく、責任も負いません',
  'disclaimer.asIs':
    'FluidEQ は現状のまま提供され、いかなる保証もありません。動作すること、目的に合うこと、今後も動き続けることを、誰も約束していません。これは GNU General Public License の第15条および第16条が述べている内容で、このコピーを譲り受けた場合でも、対価を払って入手した場合でも同じです。',
  'disclaimer.liability':
    'FluidEQ はコンピューターの音声処理を変更し、Equalizer APO をインストールして制御します。Equalizer APO は管理者権限で動作し、Windows の音声経路に入る別個のプログラムです。法律が認める最大限の範囲で、{author} は本ソフトウェアの使用によって生じた損害について責任を負いません。聴覚、スピーカーやヘッドホンなどの機器、データやほかのソフトウェア、そのほか何であれ、予見できなかった損失も含みます。',
  'disclaimer.volume':
    '音は大きくなることがあり、イコライジングによって元の素材より大きくなることもあります。設定を変える前に音量を下げ、変えたあとで上げてください。',
  'disclaimer.localLaw':
    '国によっては、販売者が一定の保証や責任を排除することが認められていません。その場合はその国の規定が適用され、この通知は法律があなたに与える権利を奪うものではありません。',
  'disclaimer.accepting':
    'FluidEQ を使用することで、以上の内容に同意したことになります。',
  'disclaimer.language':
    'この通知は英語で書かれています。翻訳が英語の本文と異なる場合は、英語の本文が優先します。',
  'disclaimer.accept': '理解して同意します',
  'disclaimer.decline': '終了',
  'provenance.heading': 'このコピーの入手元を確認してください',
  'provenance.body':
    'FluidEQ の公式な署名済みインストーラーは fluideq.com からのみ配布されます。ソースからのビルドは公式リポジトリを使用してください。GPL は第三者が FluidEQ を複製、改変、再ビルド、販売することを認めていますが、それらのビルドが FluidEQ によって自動的に署名、検査、サポート、承認されるわけではありません。公式を名乗るダウンロードに有効な Windows のデジタル署名がない場合は、閉じて報告してください。',
  'provenance.site': '公式サイト: fluideq.com',
  'provenance.repository': '公式ソース: github.com/StartSWest/FluidEQ',
  'language.title': '言語',
  'language.aria': '表示言語',
  'theme.aria': 'テーマ',
  'theme.ocean': 'オーシャン',
  'theme.black': 'ブラック',
};

export default app;
