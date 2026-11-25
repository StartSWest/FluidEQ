// 2.6 の新機能（`renderer/components/featureTour/release26.tsx` と `release26Visuals.tsx`）。
const tour26 = {
  'tour.v26.window.name': '新しいウィンドウ',
  'tour.v26.window.subtitle': 'フラットで穏やか、ダークにもホワイトにも',
  'tour.v26.window.kicker': 'FLUIDEQ 2.6',
  'tour.v26.window.title': 'ウィンドウ全体を作り直しました',
  'tour.v26.window.lead':
    'どのページもフラットで穏やか。真っ暗から真っ白まで変えられ、色合いには 2 つ目の色が加わりました。',
  'tour.v26.window.hint':
    'ハンドルをウィンドウの上でドラッグすると、ダークからホワイトに変わります。',
  'tour.v26.window.seamLabel': 'ホワイトとダークの境界',
  'tour.v26.window.seamValue': 'ホワイト {percent}%',
  'tour.v26.window.white': 'ホワイト',
  'tour.v26.window.dark': 'ダーク',

  'tour.v26.autoEq.name': 'オート EQ',
  'tour.v26.autoEq.subtitle': '曲ごとに、その曲のサウンド',
  'tour.v26.autoEq.kicker': 'EQ · オート EQ',
  'tour.v26.autoEq.title': 'どの曲も、鳴るべきサウンドで',
  'tour.v26.autoEq.lead':
    '1 つのパネルが曲ごとのサウンドを決めます。サウンドを保存した曲はそのサウンドで、サウンドを設定したアルバムは全曲がそのサウンドで、それ以外は最後に選んだサウンドで再生されます。',
  'tour.v26.autoEq.point1':
    '再生中の曲と、そのサウンドの出どころ：曲自身、アルバム、またはあなた。',
  'tour.v26.autoEq.point2':
    '曲のサウンドとアルバムのサウンド。それぞれにスイッチがあり、「この曲用に保存」もあります。',
  'tour.v26.autoEq.point3':
    'スマート補正は曲ごとに一度測定して落ち着き、その補正を保持します。どのプリセットの上にも重なります。',
  'tour.v26.autoEq.open': 'EQ を開く',

  'tour.v26.mic.name': 'マイク',
  'tour.v26.mic.subtitle': 'マイクのためのラック',
  'tour.v26.mic.kicker': 'マイク',
  'tour.v26.mic.title': 'どのアプリでも、クリアで安定した声',
  'tour.v26.mic.lead':
    '新しいマイクタブは、マイクごとのサウンドを FluidEQ Engine で整えます。そのマイクを使うすべてのアプリに、その結果が届きます。',
  'tour.v26.mic.point1':
    'ローカットとノイズキャンセリングから、声のレベルとリバーブまで 9 つの段。それぞれにスイッチとプリセットがあります。',
  'tour.v26.mic.point2':
    '話しながら聞こえる自分の声：マイクに届く音が、相手に聞こえる音の後ろにかすかに。',
  'tour.v26.mic.point3':
    '始めやすいプロファイル：配信、ポッドキャスト、ゲームチャット、歌、ボイスエフェクトなど。',
  'tour.v26.mic.open': 'マイクを開く',

  'tour.v26.eq.name': 'EQ ページ',
  'tour.v26.eq.subtitle': '3 つのタブと自分だけのプリセット',
  'tour.v26.eq.kicker': 'EQ',
  'tour.v26.eq.title': '3 つのタブになった EQ ページ',
  'tour.v26.eq.lead':
    'あなたの EQ、プリセット、トーンは、それぞれの道具を 1 列にまとめ、バンドはグラフのすぐ下にあります。どのプリセットカードにもカーブが描かれ、「新しいプリセット」で自分だけのプリセットを作れます。',
  'tour.v26.eq.point1':
    'あなたの EQ、プリセット、トーン。名前の横に、それぞれの中身が表示されます。',
  'tour.v26.eq.point2':
    '「自分の」では「新しいプリセット」で作れます。グラフで形作るカーブと、DSP ページ用のラックです。',
  'tour.v26.eq.point3':
    'どのプリセットカードにもカーブが描かれ、星を付けるとお気に入りに残ります。',
  'tour.v26.eq.open': 'EQ を開く',

  'tour.v26.dynamics.name': 'ダイナミクス',
  'tour.v26.dynamics.subtitle': 'バンドごとのカーブ',
  'tour.v26.dynamics.kicker': 'DSP · ダイナミクス',
  'tour.v26.dynamics.title': 'ダイナミクスの働きを、バンドごとに見る',
  'tour.v26.dynamics.lead':
    '各バンドがカーブを描き、そのレベルが音楽に合わせてライブでカーブの上を動きます。静かなときは持ち上げ、大きいときは抑えます。',
  'tour.v26.dynamics.point1':
    '各バンドが今していること（持ち上げか、抑えか）を、曲の再生に合わせて表示します。',
  'tour.v26.dynamics.point2':
    '点をドラッグしてカーブを形作ります。中空の点はバンドが動き出す位置、塗りつぶしの点はかかり具合です。',
  'tour.v26.dynamics.point3':
    '正確にしたいときは、カーブの下に値を入力できます。',
  'tour.v26.dynamics.open': 'DSP を開く',

  'tour.v26.library.name': 'ライブラリ',
  'tour.v26.library.subtitle': '歌詞、タグ、3D の Cover Flow',
  'tour.v26.library.kicker': 'ライブラリ',
  'tour.v26.library.title': '新しいライブラリ、どの曲にも歌詞を',
  'tour.v26.library.lead':
    'フォルダーツリーを収めた棚、ページのように開くアルバム、修正できるタグ、3D の Cover Flow。そして歌われる言葉を 1 語ずつ照らす歌詞タブ。',
  'tour.v26.library.point1':
    'タイミング付きの行が、曲に合わせて 1 語ずつ光ります。行を押すとそこから再生します。',
  'tour.v26.library.point2':
    'ブラウザーで LRCLIB、Genius、Musixmatch の歌詞を探すか、読み込めば、歌詞は曲と一緒に残ります。',
  'tour.v26.library.point3':
    '「カラオケで開く」で、歌詞をカラオケメーカーに渡せます。',
  'tour.v26.library.open': 'ライブラリを開く',

  'tour.v26.karaoke.name': 'カラオケ',
  'tour.v26.karaoke.subtitle': '歌を採点します',
  'tour.v26.karaoke.kicker': 'カラオケ',
  'tour.v26.karaoke.title': '歌って、どれだけ近づけたか確かめる',
  'tour.v26.karaoke.lead':
    'カラオケは歌ったすべての音を採点し、音名を曲のキーで表し、コードをずっと正確に聴き取り、ライブラリのプレーヤーで再生します。',
  'tour.v26.karaoke.point1':
    '歌うにつれて、ピッチの帯があなたの声の色で満ちていきます。',
  'tour.v26.karaoke.point2':
    '1 音ごとの判定と、帯の下にセルの列として並ぶ歌詞の行。',
  'tour.v26.karaoke.point3':
    '歌いながら見えるスコアと、最後に曲のマップ付きのまとめ。',
  'tour.v26.karaoke.open': 'カラオケを開く',

  'tour.v26.also': '2.6 のその他の新機能',
  'tour.v26.also.normalizer':
    'ノーマライザーはあなたのものに。DSP プリセットがオン・オフすることはもうありません。',
  'tour.v26.also.deEsser':
    'より多くの DSP プリセットで「s」の音がやわらかに。ローカットとハイカットはダイヤルを回した瞬間に聞こえます。',
  'tour.v26.also.wave':
    'タイトルバーの波形に 10 の新しいスタイルとレコーダーが加わり、再生中のプリセット名を表示します。',
  'tour.v26.also.notices':
    '通知は 1 か所、プレーヤーバーの右下に表示されます。',
  'tour.v26.also.lighter':
    'コンピューターの負担を軽減：ウィンドウはオーディオのブロックごとに再描画しなくなりました。',

  'tour.v26.looks.name': 'ルック選択',
  'tour.v26.looks.subtitle': 'どのルックも動く、ライブ描画',
  'tour.v26.looks.kicker': 'シーン · ルック',
  'tour.v26.looks.title': '選択画面のどのルックも動きます',
  'tour.v26.looks.lead':
    'ルック選択はライブラリと同じレイアウトになり、再生中のルックで開き、標準のルックをすべてライブで描きます。表示中のシーンはそれぞれクリップを再生します。',
  'tour.v26.looks.point1':
    'ライブラリと同じ場所のレール：スタイル、続いて種類別のシーン。',
  'tour.v26.looks.point2':
    '標準のルックはどれもタイルの中でライブで動き、再生中のものに印が付きます。',
  'tour.v26.looks.point3': 'グリッドか詳細、そしてすべてを対象にした検索。',
  'tour.v26.looks.open': 'グラフを開く',

  'tour.v26.colours.name': 'ウィンドウの色',
  'tour.v26.colours.subtitle': 'シーンがウィンドウに貸す色',
  'tour.v26.colours.kicker': 'シーン · ウィンドウの色',
  'tour.v26.colours.title': 'シーンがウィンドウに貸す色を調整',
  'tour.v26.colours.lead':
    'シーンにはウィンドウの色が 1 組あり、昼の色が夜に向けて暗くなります。「ウィンドウの色」で変更でき、「自動」で元の色を探し直し、「シーンの色に戻す」で戻せます。',
  'tour.v26.colours.point1':
    'シーンがウィンドウに貸す色。それぞれを見本から変更できます。',
  'tour.v26.colours.point2': 'その色で見えるウィンドウそのもの。',
  'tour.v26.colours.point3':
    '「自動」でシーン本来の色を探し直し、「シーンの色に戻す」で元に戻します。',
  'tour.v26.colours.open': 'シーンを開く',

  'tour.v26.gallery.name': 'ギャラリー',
  'tour.v26.gallery.subtitle': 'ライブラリと同じレイアウト',
  'tour.v26.gallery.kicker': 'シーン · ギャラリー',
  'tour.v26.gallery.title': 'ライブラリと同じレイアウトのギャラリー',
  'tour.v26.gallery.lead':
    '検索は上に、カテゴリーは 1 列に。新しいアカウントは無料クレジット 1 つ（残せるシーン 1 つ）から始まり、シーンは 1 日の上限内でダウンロードできます。',
  'tour.v26.gallery.point1':
    'ライブラリのバーと同じく、上に検索、1 列にカテゴリー。',
  'tour.v26.gallery.point2':
    '表示中のシーンはそれぞれクリップを再生します。アニメーションをオフにすると止まります。',
  'tour.v26.gallery.point3':
    '残すシーンにはクレジットを 1 つ使います。新しいアカウントには 1 つ付いています。',
  'tour.v26.gallery.open': 'シーンを開く',

  'tour.v26.publish.name': '押すだけで公開',
  'tour.v26.publish.subtitle': 'プレビューは自動で録画',
  'tour.v26.publish.kicker': 'スタジオ · 公開',
  'tour.v26.publish.title': '審査に送れば、プレビューは自動で録画',
  'tour.v26.publish.lead':
    '「審査に送る」を押すと、無音のデモ曲でシーンのプレビューが録画されます。「AI で書く」はシーンのチャットからメモを埋めます。',
  'tour.v26.publish.point1': 'メモは「AI で書く」で埋めるか、自分で書きます。',
  'tour.v26.publish.point2':
    '書いた一行は、送る前にすべての言語に翻訳されます。',
  'tour.v26.publish.point3':
    '「審査に送る」でプレビューのクリップが録画されるので、待たされることはありません。',
  'tour.v26.publish.open': 'シーンを開く',

  'tour.v26.alsoScenes': '2.6 のその他の新機能',
  'tour.v26.alsoScenes.auto':
    '「自動」は再生中のシーンの間に次のシーンを準備し、クロスフェードで切り替えます。読み込みのリングは出ません。',
  'tour.v26.alsoScenes.ambient':
    '環境光ではパネルがフラットなまま。ライブラリではカバーの後ろでシーンが再生されます。',
  'tour.v26.alsoScenes.karaoke':
    'カラオケのシーンは歌詞ウィンドウで再生され、専用の透明度とぼかしがあります。',
  'tour.v26.alsoScenes.studio':
    'スタジオは常に自分のシーンをまとい、ライブラリと同じレイアウトです。',
} as const;

export default tour26;
