/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'ご支援をお願いします',
  'tour.eyebrow': 'このバージョンの新機能',
  'tour.title': 'FluidEQ の新機能',
  'tour.close': '閉じる',
  'tour.rail': '新機能',
  'tour.stepOf': '{current} / {total}',
  'tour.back': '戻る',
  'tour.next': '次へ',
  'tour.done': 'わかりました',
  'tour.dontShowAgain': 'このバージョンでは今後表示しない',
  'tour.releaseNotes': 'リリースノート全文',
  'tour.rail.newIn': '{version} の新機能',
  'tour.rail.always': 'FLUIDEQ のその他の機能',
  'tour.newBadge': 'NEW',
  'tour.howTitle': '始め方',
  'tour.beta': 'ベータ',
  'tour.player.kicker': 'コンパクトプレーヤー',
  'tour.player.title': 'プレーヤーに収まった FluidEQ',
  'tour.player.subtitle': 'スイッチ一つで、ウィンドウがプレーヤーに',
  'tour.player.lead':
    'タイトルバーのスイッチ一つで、FluidEQ 全体がプレーヤーに収まります。LED 時計、ランプ、イコライザー一式を備えたクラシックアンプです。「{backdrop}」ではシーンの上でガラスに変わります。同じスイッチで、離れたページに戻れます。',
  'tour.player.point1':
    'イコライザーもまるごと一緒: プリセット、バンドレイアウト、EQモード、スマート EQ、「低音」「中音」「高音」。',
  'tour.player.point2':
    '1 行にたたんだり、ほかのウィンドウの手前に置いたり、ビジュアライザーをダブルクリックして全画面にしたりできます。',
  'tour.player.point3':
    'プレーヤー専用のテーマ。「次に再生」にドロップした曲は、ライブラリとキューに加わります。',
  'tour.player.how':
    'タイトルバーの「ヘルプ」の横にある「コンパクトプレーヤー」のスイッチを押します。プレーヤーでは、同じスイッチでフル表示に戻ります。',
  'tour.player.open': 'コンパクトプレーヤーを試す',
  'tour.player.imageAlt':
    '「{player}」スイッチを丸で囲んだタイトルバーの角と、それが開く 2 つのプレーヤー：LED 時計、ランプ、イコライザー、再生キューを備えたクラシックアンプと、「{backdrop}」でオーロラの上に浮かぶ幅の広いガラスのプレーヤー。',
  'tour.player.classic': 'クラシックアンプ',
  'tour.player.glass': 'ガラス（「{backdrop}」）',
  'tour.look.kicker': '新しい見た目',
  'tour.look.title': '新しいウィンドウ、新しい色',
  'tour.look.subtitle':
    'テーマはスライダー 1 本、すべての背後にビジュアライザー',
  'tour.look.lead':
    'パネルは新しいアイコンの色で、ひとつながりの広いフロアに並びます。「{brightness}」スライダー 1 本で、ウィンドウ全体がほぼ黒から明るいオーシャンブルーまで変わります。グラフにシーンがあれば、ウィンドウはその色をまとうことも、すべての背後でそれを再生することもできます。',
  'tour.look.point1':
    '「{brightness}」はパルスアイコンのメニューにあり、「{windowColours}」では「{transparency}」と並んでいます。',
  'tour.look.point2':
    '「{windowColours}」には「{original}」「{colours}」「{ambient}」「{backdrop}」があり、それぞれウィンドウへの効果が一行で書かれています。',
  'tour.look.point3':
    'ダイアログとメニューは同じ素材になり、「{rainbow}」はアイコンの色、またはビジュアライザー自身の色で流れます。',
  'tour.look.how':
    '右上のパルスアイコンの「オーディオ操作」メニューで「{brightness}」を動かします。グラフにシーンがあるときは、グラフのバーから「{windowColours}」を開き、「{backdrop}」を選びます。',
  'tour.look.open': 'EQ を開く',
  'tour.look.imageAlt':
    'EQ ページで自分の色の FluidEQ。カーブの下に曲を描く「アナライザー」と、角の上に開いたパルスアイコンのメニュー。「明るさ」は半分、「レインボーモード」はオンです。',
  'tour.gpu.kicker': '新しいビジュアライザーエンジン',
  'tour.gpu.title': 'すべてのビジュアライザーをグラフィックカードで',
  'tour.gpu.subtitle': '40 の表示を画面の速さで、そして 3D の世界',
  'tour.gpu.lead':
    'グラフの 40 の表示は、シーンと同じエンジンで描かれるようになりました。グラフィックカード上で、画面そのもののリフレッシュレートで動くので、バーや粒子やピークがカクつかずに滑らかに動きます。さらにシーンは本物の 3D の世界にもなれます。',
  'tour.gpu.point1':
    '「{scenes}」に新しい表示が 18 種類。「{synthwave}」「{horizon}」「{towers}」「{ledwall}」など。自前の色を持たない表示はウィンドウの色をまといます。',
  'tour.gpu.point2':
    '3D の世界はキックで踏み込み、スネアで揺れ、ドロップで跳ね、「{brightness}」に合わせて夜から昼へ移ります。ドラッグすると別の角度から見られます。',
  'tour.gpu.point3':
    '表示の切り替えは次の表示へフェードし、ウィンドウが隠れている間、3D の世界はグラフィックメモリを返します。',
  'tour.gpu.how': 'グラフ上の表示名をクリックし、「{scenes}」から選びます。',
  'tour.gpu.open': 'EQ を開く',
  'tour.gpu.imageAlt':
    '夜の 3D 都市のシーンと、グラフ上で撮影した 4 つの新しい表示（「{synthwave}」「{horizon}」「{towers}」「{ledwall}」）。最初の画像では表示の選択を丸で囲んでいます。',
  'tour.gpu.world': '3D の世界',
  'tour.sparks.kicker': 'ポインターの火花',
  'tour.sparks.title': 'マウスに応えるビジュアライザー',
  'tour.sparks.subtitle': 'ポインターから火花、花びら、雪',
  'tour.sparks.lead':
    'シーンの上でマウスを動かすと、火花、花びら、雪、残り火など、そのシーンを形づくるものがポインターの後に軌跡を描き、クリックした場所ではじけます。「{ambient}」と「{backdrop}」では、鳥や花びらや光がウィンドウ全体にも漂います。',
  'tour.sparks.point1':
    'ビジュアライザーごとに飛ぶものが違います。冬のシーンなら雪、たき火なら火の粉、庭なら花びら。',
  'tour.sparks.point2':
    'Studio のステージでは常に表示されるので、シーンの作者は飛ばすものを作り込めます。',
  'tour.sparks.point3':
    'すべてのビジュアライザーに共通のスイッチ一つ：「{windowColours}」の「{rainbow}」の下にある「{sparks}」。',
  'tour.sparks.how':
    'グラフにシーンがあるときに、その上でマウスを動かしてクリックします。「{sparks}」は「{windowColours}」の「{rainbow}」の下にあります。',
  'tour.sparks.open': 'EQ を開く',
  'tour.sparks.imageAlt':
    'オーロラのビジュアライザー。ポインターの後に光る火花の軌跡があり、クリックした場所で火花がはじけています。また、「{sparks}」スイッチを丸で囲んだ「{windowColours}」。',
  'tour.sound.kicker': 'FluidEQ エンジン',
  'tour.sound.title': '描いたとおりのサウンド',
  'tour.sound.subtitle': '描いたままの高音、無音の切り替え、一度で決まるレベル',
  'tour.sound.lead':
    'FluidEQ エンジンでは、カーブが 20 kHz まで描いたとおりに鳴り、変更はクリックせずクロスフェードし、「{autoNormalize}」は新しいカーブのレベルに一度で合わせます。高音の作り方は「{precise}」か「{classic}」から選べます。',
  'tour.sound.point1':
    '「{precise}」は各バンドを描いたとおりに作ります。48 kHz の出力では、以前は 20 kHz で高音が 3.8 dB 不足していました。「{classic}」は Equalizer APO と同じ作り方で、AutoEQ が補正を調整する方式です。',
  'tour.sound.point2':
    'プリセットは切り替え時にクロスフェードします。以前は 636 回中 534 回の切り替えでパチッと鳴りましたが、今はどれも −80 dBFS を超えません。',
  'tour.sound.point3':
    'どの編集も操作したその瞬間に聞こえ、そのあと「{autoNormalize}」が直近 10 秒の音楽から割り出したレベルへ一度で移ります。',
  'tour.sound.how':
    'EQ を開いて「{eqMode}」を押します。「{treble}」で「{precise}」か「{classic}」を選びます。あなたの EQ と補正は別々に設定できます。',
  'tour.sound.open': 'EQ を開く',
  'tour.sound.imageAlt':
    'ボタンの下に開いた「{eqMode}」メニューで、「{treble}」が「{precise}」になっています。「{precise}」は描いたとおりに、「{classic}」は 48 kHz の出力で 20 kHz が 3.8 dB 低く鳴る高音のカーブ。そしてプリセット切り替え時の 5 kHz 以上の音：2.0 以前は −26 dBFS のクリック、今は −80 dBFS を超えるものはありません。',
  'tour.sound.trebleChart': '高音（1〜20 kHz）',
  'tour.sound.switchChart': 'プリセット切り替え時の 5 kHz 以上',
  'tour.sound.before': '2.0 以前',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'スタジオのビュー',
  'tour.graph.title': 'スタジオのように音を読むグラフ',
  'tour.graph.subtitle': '12 のビュー、80 dB のアナライザー',
  'tour.graph.lead':
    'グラフは再生中の音をスタジオのアナライザーのように測ります。スペクトログラムやウォーターフォールから、ステレオ、ラウドネス、位相まで 12 のビューがあり、音楽が動いても目盛りは動きません。',
  'tour.graph.point1':
    '「{analyzer}」「{spectrogram}」「{rta}」「{waterfall}」「{scope}」ほか 7 つ。表示の選択の「{analysis}」にあります。',
  'tour.graph.point2':
    '再生中の音は 80 dB の深さで 10 Hz まで、1 点あたり 1/12 オクターブで描かれるので、単音は本当のレベルで表示されます。',
  'tour.graph.point3':
    'EQ は ±20 dB のまま、それを超えるカーブのために端に余裕があり、周波数はアナライザーと同じく 10、20、50、100 と表示されます。',
  'tour.graph.how':
    'グラフ上の表示の名前をクリックして、「{analysis}」からビューを選びます。グラフをダブルクリックすると全画面に、Ctrl+G でグリッドの表示を切り替えます。',
  'tour.graph.open': 'EQ を開く',
  'tour.graph.imageAlt':
    '再生中の曲でのグラフの「アナライザー」: 80 dB の深さのライブスペクトルとその上のピーク、いちばん上の EQ カーブ、そして隅に「解析」のビュー一覧。',

  'tour.games.kicker': 'ゲームプリセット',
  'tour.games.title': 'ゲームごとに、それぞれの音を',
  'tour.games.subtitle': 'ゲームが手前に来ると切り替わる',
  'tour.games.lead':
    'ゲームごとの音は一度選ぶだけです。ゲームが手前に来ると FluidEQ がその音に切り替え、何度 Alt+Tab で移っても、ゲームを終了するまでその音を保ち、終了後はそれまでの音に戻します。',
  'tour.games.point1':
    'Steam、Epic Games、EA、GOG、Ubisoft、Battle.net、Xbox のゲーム、または今開いている任意のプログラム。',
  'tour.games.point2':
    '「ゲーム」のプリセットは「ゲームモード」をオンにして FluidEQ が加える遅延を減らし、ページにはその遅延が実測値で表示されます。',
  'tour.games.point3':
    'デスクトップのカードが何に切り替えたかを知らせ、ゲームを終了すると、何に戻ったかを別のカードが知らせます。',
  'tour.games.how':
    '「EQ」を開いて「ゲームプリセット」を選び、「ゲームを追加」を押します。次に、その行の選択欄でゲームの音を選びます。',
  'tour.games.open': 'ゲームプリセットを開く',
  'tour.games.imageAlt':
    'デスクトップの 3 つの場面：ゲームが手前にあり、音を読み込んだことを知らせる FluidEQ のカード。同じゲームを最小化しても音はそのまま。ゲームを閉じると、元の音に戻ったことを知らせるカード。',
  'tour.games.stepFront': '手前に来たとき：そのゲームの音を読み込みます',
  'tour.games.stepAway': '最小化や Alt+Tab のとき：音はそのままです',
  'tour.games.stepClosed': '閉じたとき：元の音に戻ります',
  'tour.presets.kicker': '新しいプリセット',
  'tour.presets.title': 'ジャンルらしく鳴るプリセット',
  'tour.presets.subtitle': 'チェーン全体を、すべて同じラウドネスで',
  'tour.presets.lead':
    'すべてのプリセットを測定し直してレベルをそろえたので、切り替えて変わるのは音量ではなく音の性格です。しかも今は、どのプリセットも FluidEQ エンジンで Equalizer APO と同じくらいはっきり聞こえます。',
  'tour.presets.point1':
    '{chains} のチェーンのうち {styles} は音楽スタイル。さらに「音楽」「映画」「ゲーム」のルーム版もあります。',
  'tour.presets.point2':
    'プリセットのカーブはグラフ上に専用のレイヤーとして表示され、強さを下げることもできます。',
  'tour.presets.point3':
    'どの音楽スタイルにも解説があります。ポインターを合わせると、リストの横に開きます。',
  'tour.presets.how':
    '「EQ」を開いて「プリセット」を押すか、「DSP」の上部でチェーンを選びます。',
  'tour.presets.open': 'EQ を開く',
  'tour.presets.imageAlt':
    'ロックを選んだプリセットの選択欄と、リストの横に開いたその解説。番号付きのポイントが並ぶカーブ、各ポイントの役割、そして測定したラウドネス。',
  'tour.tone.kicker': 'トーンコントロール',
  'tour.tone.title': '低音・中音・高音を、アンプのように',
  'tour.tone.subtitle': '独自のカーブを持つ 3 つのノブ',
  'tour.tone.lead':
    'バンドを選択していないとき、「低音」「中音」「高音」が独立したカーブとして音を整え、両側にはローカットとハイカットがあります。曲を温かくしたり明るくしたりする、いちばん手早い方法で、バンドは設定したまま変わりません。',
  'tour.tone.point1':
    'イコライザーは、何も選択していないバンド全体の表示で開きます。',
  'tour.tone.point2':
    '新しい 20 バンドのレイアウト。どのレイアウトも標準の周波数に並びます。',
  'tour.tone.point3':
    'バンドは間隔に合った幅で開くので、間に隙間がなく、2 つのバンドが同じ音域を受け持つこともありません。',
  'tour.tone.how':
    'バンドを選択せずに「EQ」を開き、「低音」「中音」「高音」のいずれかを回します。ノブを Ctrl+クリックすると、その音域がフラットに戻ります。',
  'tour.tone.open': 'EQ を開く',
  'tour.tone.imageAlt':
    '低域・中域・高域の 3 つに分かれたイコライザーのカーブ、それを動かす 3 つのノブ、そして 6 から 31 バンドまでのクイックレイアウト。',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'ビジュアライザーを自分で作る',
  'tour.studio.subtitle': 'すべてのアカウントで無料',
  'tour.studio.lead':
    'スタジオは、アイデアを音楽に合わせて動くシーンに変えます。すべてのアカウントで無料です。好きなだけシーンを作成・エクスポート・公開できます。',
  'tour.studio.point1':
    'どのシーンもギャラリーに載る前に審査され、承認されるとどこでも無料であなたのために再生されます。',
  'tour.studio.point2':
    'シーンは本物の 3D ワールドにでき、キックに合わせて踏み込み、ドロップで跳ね上がります。',
  'tour.studio.point3':
    'AI 用のプロンプトをコピーすると、AI アシスタントがシーンを見て、曲の動きを聴き取れます。',
  'tour.studio.how':
    'ビジュアライザーを開き、サイドバーで「スタジオ」を選びます。',
  'tour.studio.open': 'ビジュアライザーを開く',
  'tour.studio.imageAlt':
    'ステージで Alpine を再生しているスタジオ。雪山の下の湖とオーロラ、その下に AI でシーンを作る3つの手順と、2つの注記（すべてのアカウントで無料、公開したシーンは制作者には無料で再生）。',
  'tour.studio.earned': '公開済み：あなたには無料で再生',
  'tour.help.kicker': 'ヘルプ',
  'tour.help.title': 'ガイドに、自分の言葉で聞く',
  'tour.help.subtitle': '入力ミスも、語形の違いも、10 か国語も',
  'tour.help.lead':
    '「音が出ない」「リミッター」「壁紙」のように、友だちに聞く感覚で、10 か国語のどれでもガイドを検索できます。いちばん合う章が最初に表示され、ガイドはその操作の場所まで移動して、図の中で丸く囲みます。',
  'tour.help.point1':
    '入力ミスや語形の違いを吸収し、人がふだん使う呼び方も知っています。',
  'tour.help.point2':
    '図の中の操作には、紙のマニュアルのように番号が振られています。',
  'tour.help.point3': 'F1 でどこからでも開き、Enter で次の一致箇所に進みます。',
  'tour.help.how':
    'F1 を押すか、タイトルバーの本のアイコンを押して「ユーザーガイド」を選び、探していることを入力します。',
  'tour.help.open': 'ヘルプを開く',
  'tour.help.imageAlt':
    '「音が出ない」で検索したユーザーガイド。一致した語に印が付いて順位順に並ぶ章と、操作に番号が振られた図。',
  'tour.help.query': '音が出ない',

  'tour.engine.kicker': '独自のオーディオエンジン',
  'tour.engine.title': 'FluidEQ エンジンの登場',
  'tour.engine.subtitle': '聞こえるすべての音に EQ と DSP を',
  'tour.engine.lead':
    'FluidEQ に独自のオーディオエンジンが加わりました。Windows のオーディオサービスの中で、サウンドカードのエフェクトの後に動作します。ライブラリだけでなく、ゲーム、ブラウザー、ストリーミングアプリなど、コンピューターで再生されるすべての音に EQ と DSP ラック全体をかけます。',
  'tour.engine.point1':
    'FluidEQ で何も再生していなくても、システムのすべての音に DSP ラックがかかります。',
  'tour.engine.point2':
    '曲を識別するライブ音量調整と、再生しながら音をきれいにするノイズ除去。',
  'tour.engine.point3':
    'FluidEQ を終了すると、音はすぐに元どおりになります。クラッシュした後でも同じです。',
  'tour.engine.how':
    'インストール時に FluidEQ エンジンを選ぶか、右上のパルスアイコンの「オーディオ操作」メニューを開き、いちばん上のエンジンのカードを押して「FluidEQ エンジン」を選び、「適用」を押します。次に「DSP」を開き、いずれかのアプリで音を再生しながらステージをオンにします。',
  'tour.engine.open': 'DSP を開く',
  'tour.engine.flow.label':
    'コンピューターで再生されるすべての音は、FluidEQ エンジン（まず EQ、次に DSP ラック）を通って、ヘッドホンやスピーカーに届きます。',
  'tour.engine.flow.games': 'ゲーム',
  'tour.engine.flow.browser': 'ブラウザー',
  'tour.engine.flow.music': '音楽アプリ',
  'tour.engine.flow.video': '動画',
  'tour.engine.flow.inside': 'Windows オーディオの内部',
  'tour.engine.flow.eq': 'あなたの EQ',
  'tour.engine.flow.rack': 'DSP ラック',
  'tour.engine.flow.headphones': 'ヘッドホン',
  'tour.engine.flow.speakers': 'スピーカー',

  'tour.room.kicker': 'ヘッドホンでサラウンド',
  'tour.room.title': 'ルームに座る',
  'tour.room.subtitle': '24 のルーム、すべて無料',
  'tour.room.lead':
    'ルームはヘッドホンをリスニングルームに変え、音の各チャンネルがあなたの周りに立つスピーカーになります。11 のクラシックルームに 13 の新しいルームが加わり、どれも測定で違いを確かめてあります。そして、すべて無料です。',
  'tour.room.point1':
    'ステレオは目の前の 2 本のスピーカーに、望めば部屋いっぱいに。5.1 の映画は 5 本とサブに、7.1 のゲームはリング全体に。',
  'tour.room.point2':
    '「おすすめ」「クラシックルーム」「自分の」からルームを選びます。ルームを形づくるものはすべて、そのページにあります。',
  'tour.room.point3':
    'リスニングテストは 5 組の聴き比べで、音を目の前に置く頭を耳で選びます。',
  'tour.room.how':
    'DSP を開き、レールでルームを選んでオンにします。ルームを選び、スピーカーをドラッグするかダイヤルを回し、「あなたの頭」で「リスニングテストを始める」を押します。',
  'tour.room.open': 'ルームを開く',
  'tour.room.imageAlt':
    '上から見た部屋：中央の頭の周りに 7 本のスピーカーとサブが立ち、それぞれから耳への経路が伸びています。',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': '永久にあなたのものになるシーン',
  'tour.plus.subtitle': 'ビジュアライザー、スタジオ、ライティングなど',
  'tour.plus.lead':
    'FluidEQ を成長させる追加機能のタブ。グラフィックカードで描かれるシーン、自分のシーンを作るスタジオ、デスクトップ背景、ダイナミックライティング。シーンは1クレジットでずっとあなたのもの。イコライザー、ラック、プレーヤーはこれまでどおり無料です。',
  'tour.plus.point1':
    '「オーディオ操作」メニューの「アカウント」からサインインします。確認済みのアカウントには最初に無料のクレジットが付きます。',
  'tour.plus.point2':
    'クレジットのパックは一度払うだけで、支払いの前にわかりやすい言葉の規約を読めます。自動更新はなく、アプリがカード情報を見ることもありません。',
  'tour.plus.point3':
    'どのシーンも先に見られ、入手したシーンはサインインしたどのコンピューターでも再生されます。',
  'tour.plus.how':
    '「ビジュアライザー」タブを開きます。左側に「ギャラリー」「スタジオ」「ダイナミック ライティング」が並んでいます。',
  'tour.plus.open': 'ビジュアライザーを開く',
  'tour.plus.imageAlt':
    'ビジュアライザータブ。横にギャラリー、スタジオ、ダイナミック ライティングが並び、ギャラリーにクローム、ブルーム、オーロラ、アルプス、ネオンシティが表示されています。',
  'tour.scene.alpine': 'アルプス',
  'tour.scene.aurora': 'オーロラ',
  'tour.scene.bloom': 'ブルーム',
  'tour.scene.chrome': 'クローム',
  'tour.scene.neonCity': 'ネオンシティ',

  'tour.visualizers.kicker': 'ビジュアライザー',
  'tour.visualizers.title': '音楽に合わせて動くシーン',
  'tour.visualizers.subtitle': 'グラフィックスカードで描画',
  'tour.visualizers.lead':
    'シーンは、星空の下の山々、オーロラのカーテン、ネオンの街といった生き生きと動く絵を、グラフィックスカードで EQ カーブの下に描きます。低音、ビート、高音がそれぞれ別のものを動かし、周りのウィンドウをシーンの色に染めることもできます。',
  'tour.visualizers.point1':
    'すべてを一つの選択欄から。形と色を変えられる {styles} の無料スタイルと、カテゴリ別のシーン。',
  'tour.visualizers.point2':
    'ギャラリーを見て回り、FluidEQ のサンプルを 10 秒間試して、気に入ったシーンを追加できます。',
  'tour.visualizers.point3':
    'ビジュアライザーの自動切り替えや全画面表示ができ、シーンのアタックとリリースは「表示」メニューで設定できます。',
  'tour.visualizers.how':
    'グラフ上の表示の名前をクリックして「ビジュアライザー」からシーンを選ぶか、「ビジュアライザー → ギャラリー」ですべてを見て回ります。',
  'tour.visualizers.open': 'EQ を開く',
  'tour.visualizers.imageAlt':
    '夜の湖の向こうにそびえる山々を描いたシーン「アルプス」が、グラフの EQ カーブの下で再生され、その下にさらに 4 つのシーンが並んでいます。',

  'tour.desktop.kicker': 'デスクトップ ビジュアライザー',
  'tour.desktop.title': 'デスクトップの背景に、あなたの音楽を',
  'tour.desktop.subtitle': 'モニターごとにシーンを',
  'tour.desktop.lead':
    'シーンをデスクトップアイコンの背面に置けます。聴いている音楽に合わせて、または穏やかに単独で動き、モニターごとに別のシーンを映せます。',
  'tour.desktop.point1':
    'デスクの配置図でモニターを選び、それぞれに別のビジュアライザーを設定できます。',
  'tour.desktop.point2':
    'ウィンドウがモニターを覆っている間、PC のロック中、バッテリー駆動中は一時停止します。',
  'tour.desktop.point3': '次に FluidEQ を起動すると、自動で再開します。',
  'tour.desktop.how':
    'グラフにシーンを表示し、名前の横にあるモニターのボタンを押すか、「表示 → デスクトップの背景に設定」を選びます。',
  'tour.desktop.open': 'EQ を開く',
  'tour.desktop.imageAlt':
    '3 台のモニター。それぞれのデスクトップアイコンとタスクバーの背後に、シーンのオーロラ、アルプス、ネオンシティが映っています。',

  'tour.lighting.kicker': 'ダイナミック ライティング',
  'tour.lighting.title': 'シーンに合わせてデスクが光る',
  'tour.lighting.subtitle': 'ベータ · RGB デバイスがビジュアライザーに連動',
  'tour.lighting.lead':
    'Windows Dynamic Lighting と Razer Chroma を通して、キーボード、マウス、マウスパッド、ヘッドセット、スタンドが、グラフ上のシーンの色をまとい、そのリズムに合わせて光ります。',
  'tour.lighting.point1':
    'ビジュアライザーごとに 4 つのスタイル: シーン、カラーウェーブ、スペクトル、ビートの波紋。',
  'tour.lighting.point2':
    'デバイスを 1 台ずつ調整でき、音楽が止まったときの動作も選べます。',
  'tour.lighting.point3':
    'ライブプレビューには、光っているあなたのデスクがそのまま描かれます。ベータ版なので、お使いのデバイスでの動作をぜひお知らせください。',
  'tour.lighting.how':
    '「ビジュアライザー → ダイナミック ライティング」を開いてオンにし、グラフにシーンを表示します。',
  'tour.lighting.open': 'ビジュアライザーを開く',
  'tour.lighting.imageAlt':
    'ネオンシティのピンク、バイオレット、シアンに光るキーボード、マウス、マウスパッド。',

  'tour.share.kicker': 'どの PC も、双方向で',
  'tour.share.title': 'コンピューター間で音声を共有',
  'tour.share.subtitle': 'どちらの前に座っていても、両方の音が聞こえます',
  'tour.share.lead':
    'ゲーミング PC とノート PC が互いの音を鳴らします。どちらの前に座っていても両方が聞こえます。自宅のネットワークで、ロスレス、暗号化、そしてそのコンピューターで調整した EQ を通して。',
  'tour.share.pairLabel': '双方向',
  'tour.share.pairName': '各コンピューターが相手の音を再生',
  'tour.share.wireLabel': 'ロスレス · 暗号化 · プライベート LAN',
  'tour.share.stepsTitle': '3 ステップで設定',
  'tour.share.step1Title': '一方のコンピューターでコードをコピー',
  'tour.share.step1':
    '「音声を共有」タブを開き、「コードをコピー」を押します。コードは毎回同じです。',
  'tour.share.step2Title': 'もう一方に貼り付けてリンク',
  'tour.share.step2':
    'もう一方で「音声を共有」を開き、「もう一方のコンピューターのコード」にコードを貼り付けて「リンク」を押します。2 台はすぐに互いの音を手を加えずに再生し、それぞれが聞こえる音に自分の EQ をかけます。',
  'tour.share.step3Title': '音の行き先を選ぶ',
  'tour.share.step3':
    'リンクしたコンピューターごとに「ここで再生する」と「自分の音を送る」の 2 つのスイッチがあり、一方をオフにすると片方向になります。バーには相手の曲が表示され、そのまま操作できます。「ここで再生する」の横のスライダーで音量を調整でき、「一時停止」を押すと「再開」まで両方向が止まります。',
  'tour.share.fact1Title': 'ロスレス',
  'tour.share.fact1':
    '端から端まで Float32 PCM。メディアコーデックなし、世代劣化なし。',
  'tour.share.fact2Title': '暗号化',
  'tour.share.fact2':
    'すべてのパケットを AES-256-GCM で暗号化。コードが鍵であり、持たない人は聴けません。',
  'tour.share.fact3Title': 'リンクは保持',
  'tour.share.fact3':
    'アプリを閉じても再起動しても、どちら側でもリンクは保たれます。終わらせるのは「リンク解除」だけです。',
  'tour.share.tip':
    '小さな音量から始めてください。2 台が同時に鳴ると音量が重なります。最初のリンクの前に音量を下げてください。',
  'tour.share.open': '「音声を共有」を開く',

  'tour.library.kicker': 'あなたの音楽、あなたのプレイヤー',
  'tour.library.title': '手元の音楽のためのライブラリ',
  'tour.library.subtitle': 'フォルダーを入れると、アルバムが並ぶ',
  'tour.library.lead':
    'FluidEQ にフォルダーを指定すると、中のすべての曲と動画をタグやジャケットごと読み込み、アルバム、アーティスト、ジャンル、曲、フォルダーで眺められるコレクションにします。再生は FluidEQ 自身のプレイヤーを通るので、EQ と DSP ラックはいつも経路上にあります。',
  'tour.library.point1':
    '同じ棚を三つの見方で: リスト、グリッド、Cover Flow。大きなコレクション向けに頭文字ジャンプもあります。',
  'tour.library.point2':
    '「再生を続ける」付きの「次に再生」キュー。リストが尽きても同じジャンルの曲で続きます。',
  'tour.library.point3':
    'プレイリストと、常設の「お気に入り」。曲を右クリックすればどちらにも、キューにも追加できます。',
  'tour.library.point4':
    'スマート EQ の曲メモリー: スマート EQ が測定を続けている間に「この曲用に保存」をオンにすると、2 分後にその補正がその曲用に保存され、次に再生したときにまた適用されます。',
  'tour.library.how':
    '「ライブラリ」タブを開き、「フォルダーを追加」を押すかフォルダーをページにドロップして、スキャンが終わるのを待ちます。アルバム、アーティスト、ジャンル、曲、フォルダ、ツリーのいずれかを選び、再生を押します。',
  'tour.library.open': 'ライブラリを開く',

  'tour.dsp.kicker': 'マスタリングラック',
  'tour.dsp.title': 'DSP ラック',
  'tour.dsp.subtitle': '10 のステージ、それぞれに専用のページ',
  'tour.dsp.lead':
    'スタジオ級のステージを並べたラックです: ノーマライザー、ノイズ除去、エキサイター、ベースフォージ、イコライザー、ベースパンチ、ディメンション、ルーム、マキシマイザー、マスター。さらにライブラリの曲間のクロスフェード。FluidEQ エンジンではコンピューターで再生されるすべての音に、Equalizer APO ではライブラリにかかります。各ステージにはライブ表示のある専用のページがあり、多くはプリセットを備え、5 つのステージにはその効果だけを聴く「アイソレート」スイッチがあります。',
  'tour.dsp.point1':
    'ノイズ除去は再生しながらヒス、ハム、クリックを修復し、ニューラル音声クリーナーはライブラリの曲で働きます。',
  'tour.dsp.point2':
    'ベースフォージはベースの下に本物の 1 オクターブを足し、ベースパンチはアタック、サステイン、膨らみを整えます。「ミックス」は最大 200% です。',
  'tour.dsp.point3':
    '6 から 31 バンドのパラメトリックイコライザー（最初は 15 バンド）。最小位相か直線位相、ミッド/サイド、オーバーサンプリング、100 を超える名前付きプリセット。',
  'tour.dsp.point4':
    'LUFS ラウドネス目標とトゥルーピーク保護を備えたマスター。ストリーミングからアナログレコードまでの納品プリセットと、音量ではなく音を比べるゲインマッチ。',
  'tour.dsp.how':
    '「DSP」タブを開いて「プリセット」からチェーンを選び、サイドタブでステージをクリックしてオンにします。Equalizer APO では、先にライブラリから曲を再生します。',
  'tour.dsp.open': 'DSP を開く',

  'tour.output.kicker': '2 か所で鳴らす',
  'tour.output.title': '2 つめの出力のプロファイル',
  'tour.output.subtitle':
    'ヘッドセットとスピーカーを同時に、それぞれのプロファイルで',
  'tour.output.lead':
    'ヘッドセットとスピーカーを別々のEQで同時に鳴らせます。「2 つめの出力」にはメイン出力のEQ適用前の音声が届き、専用の保存済みプロファイルが適用されます。ルーティングドライバーは不要です。',
  'tour.output.point1':
    '「2 つめの出力」で別のデバイスをオンにし、その音量を調整します。',
  'tour.output.point2':
    'デバイスの下で保存済みプロファイルを選ぶか、横の「{editSound}」を押すと、メイン出力を切り替えずにそのサウンドを変更できます。メイン出力の調整はそのままです。',
  'tour.output.point3':
    '「再生はひとつだけ」: FluidEQ で何かを再生するとマシンの他の再生が止まり、逆も同じです。',
  'tour.output.point4':
    '各出力は自分でタイミングを合わせます。開始時は約 30 ms 遅れ、途切れたときだけ少し増やし、遅延をミリ秒で表示します。「音声を共有」でほかのコンピューターの音を再生しているときは、その分も含めて表示します。',
  'tour.output.how':
    'EQタブの右側で「2 つめの出力」を開きます。デバイスをオンにして名前の下のEQプロファイルを選び、音量を設定します。その下に遅延が表示されます。',
  'tour.output.open': 'EQ を開く',
  'tour.output.imageAlt':
    'BlackShark V2 Proが有効な「2 つめの出力」パネル。EQプロファイル選択欄、音量スライダー、遅延が表示されています。',

  'tour.outputs.kicker': '出力ごとにサウンドを記憶',
  'tour.outputs.title': 'どの出力も、自分のサウンドを持つ',
  'tour.outputs.subtitle': 'ヘッドホンもスピーカーも、それぞれの調整で',
  'tour.outputs.lead':
    'ヘッドホンからスピーカーに切り替えると、それぞれのサウンドが戻ってきます。EQ、プリセット、トーン、カット、DSP ラック、ルーム、音量調整が出力ごとに保存されます。',
  'tour.outputs.point1':
    '出力を選ぶと、その出力用に設定した内容がすぐに戻ります。ヘッドホンとスピーカーで同じプリセットや同じカーブを共有することはもうありません。',
  'tour.outputs.point2':
    '2 つめの出力は FluidEQ エンジンから直接、独自のサウンドで再生され、メイン出力がそれを待つことはありません。横の「{editSound}」で、メイン出力を切り替えずにそのサウンドを変更できます。',
  'tour.outputs.point3':
    'Bluetooth ヘッドホンは出力の横にバッテリー残量を表示し、2 つめの出力はどれだけ遅れて再生しているかをミリ秒で表示します。',
  'tour.outputs.how':
    'EQ を開き、右側の「{output}」で出力を選びます。以降に設定した内容はその出力に残ります。2 つめの出力は「{secondOutput}」でオンにして「{editSound}」を押します。',
  'tour.outputs.open': 'EQ を開く',
  'tour.outputs.imageAlt':
    'ヘッドセットとスピーカーが交互に再生される「出力」カード。それぞれに専用のプリセット、カーブ、DSP ステージがあり、横では 2 つめの出力が独自のサウンド、バッテリー残量、「サウンドを編集」とともに同時に再生されています。',

  'tour.bands.kicker': 'EQ を数値で',
  'tour.bands.title': '各バンドの値をグラフ上に',
  'tour.bands.subtitle': 'カーブにラベル、横に EQ モード',
  'tour.bands.lead':
    '各バンドは自分のポイントの上に周波数、Q、ゲインを表示でき、ラベル同士が重なることはありません。EQ モードはグラフの上ではなく横に置かれるようになり、カーブを見ながら鳴り方を変えられます。',
  'tour.bands.point1':
    'ラベルはポイントの真上か真下に置かれ、ほかのラベルに重ならず、バンドをドラッグしている間は動かず、空きができれば元の位置に戻ります。',
  'tour.bands.point2':
    '「{eqMode}」はサイドパネルの最初のカードで、「{yourEq}」と「{corrections}」がそれぞれタブになっています。グラフの上のボタンでカードを表示できます。',
  'tour.bands.point3':
    'すべてのハンドル、スライダー、ノブをキーボードで操作でき、スライダーを動かすと同じフレームでカーブが描き直されます。',
  'tour.bands.how':
    'EQ を開き、グラフの上で「{view}」→「{everything}」を選ぶか {shortcut} を押して、バンドを動かします。値がバンドについてきます。「{eqMode}」は右側のパネルのいちばん上にあります。',
  'tour.bands.open': 'EQ を開く',
  'tour.bands.imageAlt':
    '各バンドの周波数、Q、ゲインがポイントの上に表示された EQ グラフ。1 つのバンドが矢印キーで動いており、カーブの下には「ユーザーEQ」と「補正」のタブを持つ「EQモード」カードがあります。',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': 'ひとつのバンドを左右の耳に',
  'tour.ears.title': '左右の耳を別々に調整',
  'tour.ears.subtitle': 'バンドのメニューで左 + 右',
  'tour.ears.lead':
    'バンドを右クリックして「{split}」を選ぶと、同じ周波数で左右の耳それぞれのバンドになり、ひとつずつ動かせます。左耳のカーブは実線、右耳は破線で描かれます。',
  'tour.ears.point1':
    '「{both}」は 2 つを周波数とゲインの中間でひとつに戻します。「{reset}」と「{clear}」でもひとつに戻ります。',
  'tour.ears.point2':
    '「{delete}」も同じメニューにあり、メイン EQ でも DSP ラックでも使えます。削除の前にもう一度押すよう確認します。',
  'tour.ears.point3':
    'Squiglink のカーブを片耳だけにインポートできます。「{importInto}」で左か右だけを埋め、もう片方はそのまま残ります。',
  'tour.ears.how':
    'EQ を開き、グラフ上のバンドを右クリックして「{split}」を選びます。DSP ラックの EQ でも、ステレオに適用している間は同じメニューが使えます。',
  'tour.ears.open': 'EQ を開く',
  'tour.ears.imageAlt':
    'EQ グラフ。ひとつのバンドが左耳用と右耳用に分かれて離れ、中間で再びひとつになる。左耳のカーブは実線、右耳は破線。横に「両耳」と「左 + 右」のあるバンドメニュー。',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'FluidEQ のすべてのバンドが、左右の耳で別々に鳴らせるようになりました。',
  'tour.film.eachEar.menu': 'バンドを右クリックして、メニューを開きます。',
  'tour.film.eachEar.split':
    '「左 + 右」を選ぶと、バンドが左右の耳ごとに二つに分かれます。',
  'tour.film.eachEar.lines':
    'それぞれの半分を別々にドラッグします。実線が左耳、破線が右耳です。',
  'tour.film.eachEar.sliders':
    '左右それぞれに、L または R の印が付いた専用のスライダーもあります。',
  'tour.film.eachEar.join':
    '元に戻すには「両耳」を選びます。二つの半分が真ん中で一つになります。',
  'tour.film.sound.intro': 'FluidEQ での変更は、すぐに、なめらかに聞こえます。',
  'tour.film.sound.glide':
    '音楽の再生中にバンドを動かしてみてください。変化はなめらかに移り、クリック音は出ません。',
  'tour.film.sound.precise':
    'EQモードのメニューで、高音は「精密」になっています。どのバンドも描いたとおりに、二十キロヘルツまで鳴ります。',
  'tour.film.sound.classic':
    '「クラシック」を選ぶと、Equalizer APO と同じ作り方でバンドを鳴らします。',
  'tour.film.games.intro':
    'FluidEQ では、ゲームごとに専用のサウンドを設定できます。',
  'tour.film.games.add':
    '「ゲームを追加」を押して、ランチャーにインストールされたゲームから選びます。',
  'tour.film.games.sound': '次に、そのゲームのサウンドを選びます。',
  'tour.film.games.front':
    'ゲームが前面に来ると、そのサウンドが自動で読み込まれます。',
  'tour.film.games.closed': 'ゲームを閉じると、いつものサウンドに戻ります。',
  'tour.film.compact.intro':
    '操作だけで十分なときは、FluidEQ を小さなプレーヤーにたためます。',
  'tour.film.compact.go':
    '上部のプレーヤーボタンを押すと、ウィンドウがコンパクトプレーヤーになります。',
  'tour.film.compact.eq':
    'EQ もそのまま使えます。ノブを回すと、すぐに音が変わります。',
  'tour.film.compact.back': 'ワンクリックで、元の大きなウィンドウに戻ります。',
  'tour.film.deleteImport.intro': 'EQ を守るための、二つの小さな変更です。',
  'tour.film.deleteImport.asks':
    '「バンドを削除」は、まず確認するようになりました。もう一度押すと本当に削除されます。',
  'tour.film.deleteImport.oneEar':
    '読み込みは片耳だけにもできます。「読み込み先」から「左耳」を選びます。',
  'tour.film.deleteImport.otherEar':
    '置き換わるのは左耳だけで、右耳はそのまま残ります。',
  'tour.film.outputs.intro':
    'パソコンの出力ごとに、それぞれのサウンドが保たれます。',
  'tour.film.outputs.each':
    'スピーカーからヘッドホンに切り替えると、EQ もヘッドホン用に切り替わります。',
  'tour.film.outputs.back': '戻すと、スピーカーは前のままの音で鳴ります。',
  'tour.film.outputs.second':
    '2 つめの出力から同時に鳴らすこともでき、そちらにも専用のサウンドがあります。',
  'tour.film.outputs.edit':
    '「サウンドを編集」を押すと、メインの出力を鳴らしたまま、ここで調整できます。',
  'tour.film.dsp.intro':
    'DSP ラックは、EQ のあとで、聞こえるすべての音を整えます。',
  'tour.film.dsp.preset':
    'プリセットを一つ選ぶだけで、ラック全体が一度に設定されます。',
  'tour.film.dsp.stages':
    'ステージごとに専用のページがあり、すべての操作が見渡せます。',
  'tour.film.dsp.meters':
    'メーターが音楽に合わせて動くので、何をしているかが見えます。',
  'tour.film.deesser.intro':
    'DSP ラックにディエッサーが加わりました。耳に刺さる「S」の音を抑えます。',
  'tour.film.deesser.cuts':
    '「ポッドキャストと話し声」などのプリセットを選ぶと、鋭い S の音だけが抑えられて琥珀色で示され、シンバルはそのまま残ります。',
  'tour.film.deesser.isolate':
    '「アイソレート」を押すと、取り除いた音だけが聞こえます。',
  'tour.film.headphones.intro':
    'FluidEQ は、ほかの人が測定したデータでヘッドホンを補正できます。',
  'tour.film.headphones.search':
    '「EQ プリセット」を開いて、OPRA のライブラリからお使いのヘッドホンを探します。',
  'tour.film.headphones.measure':
    '測定を一つ選びます。どれも、誰が測ったかが書かれています。',
  'tour.film.headphones.applied':
    '「この機種の EQ を適用」を押すと、補正は専用のレイヤーに入り、あなたのバンドはそのまま残ります。',
  'tour.film.headphones.paste':
    'Squiglink から書き出したデータを貼り付けることもできます。',
  'tour.film.headphones.ears': 'EQ として、両耳にも片耳だけにも適用できます。',
  'tour.film.headphones.curve': 'または、独立したカーブとして適用します。',
  'tour.film.karaoke.intro':
    'カラオケで、FluidEQ があなたの曲のステージになります。',
  'tour.film.karaoke.open':
    '「曲を開く」を押して、曲と歌詞ファイルを一緒に選びます。',
  'tour.film.karaoke.words': '再生を押すと、歌われている言葉が順に光ります。',
  'tour.film.karaoke.pitch':
    '下のピッチガイドには、歌う音がすべて表示されます。マイクをオンにすると、自分の声も重なって見えます。',
  'tour.film.maker.intro':
    'カラオケメーカーで、曲をカラオケファイルにできます。',
  'tour.film.maker.timeline':
    '曲を読み込んで「作成」を押すと、言葉と音符がすべてタイムラインに並びます。',
  'tour.film.maker.play':
    '再生すると、再生ヘッドが言葉と音符の上を進みます。どれでもドラッグして、タイミングや音程を直せます。',
  'tour.film.maker.use':
    'メーカーは、歌声から曲を自動で準備することもできます。よければ「プレーヤーで使用」を押します。',
  'tour.film.looks.intro': 'EQ の下のスペクトラムは、好きなように描けます。',
  'tour.film.looks.open': 'グラフのツールバーで「新しい表示」を押します。',
  'tour.film.looks.forms':
    '矢印で形を切り替えていけます。LED バー、ネオンバー、スカイライン、ガラスの塔など、さまざまです。',
  'tour.film.looks.shape':
    'そして形を整えます。「分割数」でバーの数が決まり、色やすき間、動きも自由に変えられます。',
  'tour.film.looks.save':
    '「保存」を押すと自分だけの表示として残せます。ファイルにして共有することもできます。',
  'tour.film.engine.intro':
    'FluidEQ には独自のオーディオエンジンがあります。EQ と DSP ラックを、パソコンで鳴るすべての音に届けます。',
  'tour.film.engine.choose':
    '右上の「オーディオ操作」メニューを開いて、エンジンのカードを押します。選ぶのは「FluidEQ エンジン」です。',
  'tour.film.engine.rack':
    '次に「DSP」を開いてプリセットを選びます。ゲームもブラウザも音楽アプリも、すべてこれを通って鳴ります。',
  'tour.film.library.intro':
    'ライブラリでは、手持ちの音楽を EQ を通して再生できます。',
  'tour.film.library.albums':
    'アルバムはジャケットで並びます。矢印でめくっていけます。',
  'tour.film.library.album':
    'アルバムをクリックすると、収録曲と一緒に開きます。',
  'tour.film.library.play':
    '再生を押すと、ほかの音と同じ EQ と DSP ラックを通して鳴ります。',
  // End of film voice.
  'tour.film.soundOn': '音声をオンにする',
  'tour.film.soundOff': '音声をオフにする',
  'tour.film.watch': '動画を見る',
  'tour.film.close': '動画を閉じる',

  'tour.myCurves.kicker': '自分だけのカーブ',
  'tour.myCurves.title': 'OPRA の隣に、自分のカーブのリストを',
  'tour.myCurves.subtitle': '自分のカーブを保存し、名前を付けて使い回す',
  'tour.myCurves.lead':
    '{eqPresets} に、OPRA ライブラリと並んで {myCurves} ができました。また使いたいカーブを、付けた名前と形の図と一緒に保存できます。Squiglink のエクスポート、.txt ファイル、今の EQ、OPRA で選んだものから追加できます。',
  'tour.myCurves.point1':
    '{applyCurve} はカーブをヘッドホン補正として再生し、強さとスイッチも独立しています。{applyEq} はそのバンドを EQ に入れます。',
  'tour.myCurves.point2':
    '{myCurves} の {squiglink} ショートカットで読み込みプレビューを開き、{save} でカーブを保存できます。',
  'tour.myCurves.point3':
    '{exportList} はリスト全体を 1 つのファイルに書き出し、バックアップや別のパソコンへの移動に使えます。{importList} で読み込むと、取り込まなかったものも教えてくれます。',
  'tour.myCurves.how':
    'EQ の {eqPresets} を開き、{myCurves} を選んで {add} を押します。',
  'tour.myCurves.open': 'EQ プリセットを開く',
  'tour.myCurves.imageAlt':
    'マイカーブを開いた EQ プリセットページ。4 つのヘッドホンカーブが、名前、入手元、追加日、形の図とともに並んでいます。Squiglink から保存したばかりのカーブが一番上に入り、ヘッドホン補正として再生されます。',

  'tour.songs.kicker': '曲ごとにサウンドを',
  'tour.songs.title': '好みのサウンドを覚えている曲',
  'tour.songs.subtitle': '一度調整すれば、毎回そのサウンドで',
  'tour.songs.lead':
    '「{songSound}」をオンにすると、曲が終わったときのプリセット、トーン、EQ が、次にその曲を再生したときに戻ってきます。調整した出力で戻ります。',
  'tour.songs.point1':
    '曲の再生中にプリセット、トーン、バンドを変えると、それがその曲に保存されます。一度も触れなかった曲には何も保存されません。',
  'tour.songs.point2':
    '曲名と戻ってきた内容を示す通知が表示され、すぐそばに「{undo}」と「{forget}」があります。',
  'tour.songs.point3':
    '曲が終わると、その前のサウンドに戻ります。出力ごとに記憶するので、同じ曲でもヘッドホンとスピーカーで違うサウンドにできます。',
  'tour.songs.how':
    'EQ を開き、右側の「{output}」で「{songSound}」をオンにします。曲を再生してプリセットを選ぶかトーンを回し、最後まで聴くかスキップします。',
  'tour.songs.open': 'EQ を開く',
  'tour.songs.imageAlt':
    '順番に再生される 4 曲のキュー。3 曲にはそれぞれ残されたプリセットとカーブがあり、1 曲は未調整です。その上には、記憶された曲が表示する通知と「元に戻す」「この曲の記憶を消す」があります。',

  'tour.deesser.kicker': 'やわらかな S',
  'tour.deesser.title': 'DSP ラックにディエッサー',
  'tour.deesser.subtitle': '鋭い S だけを下げ、シンバルはそのまま',
  'tour.deesser.lead':
    '「{deEsser}」は声の鋭い S・T・SH の音を、鳴っている間だけ下げます。シンバルやハイハット、ほかの高域はそのままです。',
  'tour.deesser.point1':
    '曲そのもののレベルを基準に S を見つけるので、静かな曲も大きな曲も同じように扱い、捉えた S とどれだけ下げたかがひとつずつ見えます。',
  'tour.deesser.point2':
    'S を構成する周波数だけ、その上の帯域すべて、または声全体を下げられます。「{isolate}」では取り除いた音だけを聴けます。',
  'tour.deesser.point3':
    '「{speech}」「{podcast}」「{audiobook}」でオンになります。ラックのどのフィルターも自分のプロファイルを保存できるようになりました。',
  'tour.deesser.how':
    'DSP を開き、左のリストで「{deEsser}」を選ぶか、「{podcast}」プリセットを選びます。プロファイルから始めて、すべての S を捉えるまで「{sensitivity}」を上げてください。',
  'tour.deesser.open': 'DSP を開く',
  'tour.deesser.imageAlt':
    '流れていくディエッサーの帯。声の S はステージが働き始める線の上に立ち、その下に琥珀色のカットが下がる。ハイハットは灰色でそのまま。上には「スペクトル」を選んだステージ、下には「音声」「ポッドキャスト」「オーディオブック」。',

  'tour.chat.kicker': '頼むだけでシーンが変わる',
  'tour.chat.title': '変更を頼んで、ステージで確かめる',
  'tour.chat.subtitle': 'スタジオのステージの横にチャット',
  'tour.chat.lead':
    '「{studio}」のステージの横にチャットが付きました。シーンの見た目、音楽に合わせた動き、色や光など、変えたいことを伝えると、あなた自身の AI がシーンを編集し、できたバージョンを次々にステージで再生します。',
  'tour.chat.point1':
    '返信ごとに作ったバージョンが残り、「{bringBack}」で前のバージョンに戻せます。シーンごとに過去のチャットも残ります。',
  'tour.chat.point2':
    '「{attach}」でメッセージにシーンの画像を添えられ、その上に描いて伝えたいことを示せます。作業中に送ったメッセージは待ち行列に入り、まとめて送られます。',
  'tour.chat.point3':
    'このコンピューターにインストールされた Claude Code で、あなた自身のプランを使って動き、利用上限の残りも表示します。',
  'tour.chat.how':
    '「{plus}」を開いて一覧から「{studio}」を選び、シーンを選ぶか新しく始めて、ステージの横の入力欄に書き込みます。',
  'tour.chat.open': 'ビジュアライザーを開く',
  'tour.chat.imageAlt':
    'スタジオのステージとその横のチャット。スネアでステージのライトを光らせてという依頼、返信の手順がひとつずつチェックされ、「元に戻す」付きでバージョン 2 が残り、バージョン 2 の再生とともにステージのライトが光り始める。',
  'tour.chat.ask': 'スネアに合わせてステージのライトを光らせて。',
  'tour.chat.reply':
    'できました。スネアごとに両方のスポットライトが白く光り、ピンクに戻ります。',

  'tour.looks.kicker': '自分だけのビジュアライザー',
  'tour.looks.title': 'グラフの表示を自分で作る',
  'tour.looks.subtitle': 'あなたの形、あなたの色、あなたの動き',
  'tour.looks.lead':
    'EQ の下のスペクトラムは好きなように描けます。LEDバーやネオンバーから、段丘、スカイライン、ガラスの塔まで {forms} の形から一つ選び、その形に合った「自動」配色や、周波数別、レベル別、ヒート別に色を付け、アタックの速さとピークの残る長さを決め、ピークをスパーク、コメット、リップルで飾ります。自分の表示として保存し、ファイルとして共有できます。',
  'tour.looks.point1':
    '{forms} の形、それぞれに専用の設定: 分割数、間隔、塗り、太さ、塗りつぶしか輪郭か。',
  'tour.looks.point2':
    'それぞれの形に合った「自動」配色のほか、自分の色で作るランプで周波数、レベル、ヒート別に、または単色で色付け。',
  'tour.looks.point3':
    'アタックとリリースが動きを決め、ピーク発光、ピークの塗りつぶし、12 種類のピークマークがヒットの見え方を決めます。',
  'tour.looks.point4':
    'グローはどのモードでも使えます。表示はファイルに書き出し、ファイルから読み込めます。',
  'tour.looks.how':
    'EQ タブで、グラフのツールバーの「新しい表示」を押します。ピッカーで形を選ぶかスペースキーで順に切り替え、音楽を流しながら色と動きを調整して、保存します。',
  'tour.looks.open': 'EQ を開く',

  'tour.karaoke.kicker': '家のステージ',
  'tour.karaoke.title': 'ピッチガイド付きカラオケ',
  'tour.karaoke.subtitle': 'あなたの曲、あなたの歌詞、あなたのマイク',
  'tour.karaoke.lead':
    '歌詞ファイルの有無を問わず曲をドロップすると、FluidEQ がプレイリストにまとめ、ジャケットや動画の上に同期歌詞を表示し、マイクを聴いてあなたのピッチをメロディーに重ねて描きます。すべてこのコンピューターの中で完結し、マイクは録音も再生もされません。',
  'tour.karaoke.point1':
    '「ガイドボーカル」スライダー: カラオケメーカーで FluidEQ が曲の歌声を分離すると、伴奏のみから原曲そのものまで動かせます。インスト音源のファイルは不要です。',
  'tour.karaoke.point2':
    'ピッチレーン: 曲の音符はブロック、あなたの声はその上に重なるライブの線。高い、音程一致、低いを表示します。',
  'tour.karaoke.point3':
    '歌い終わると練習すべき箇所を並べたパフォーマンスレビューが出て、カウントインでもう一度挑戦できます。',
  'tour.karaoke.point4':
    'LRC、単語タイミング付きの拡張 LRC、音節とピッチ付きの UltraStar を、MP3、FLAC、WAV、OGG、M4A などの上で読み込みます。翻訳歌詞と推定ギターコードも付きます。',
  'tour.karaoke.how':
    '「カラオケ」タブを開き、「曲を開く」か「フォルダーを追加」を押し、プレイリストで曲を選び、マイクをオンにしてピッチガイドを表示し、再生を押します。',
  'tour.karaoke.open': 'カラオケを開く',

  'tour.maker.kicker': '自分で作る',
  'tour.maker.title': 'カラオケメーカー',
  'tour.maker.subtitle': 'どんな曲もカラオケファイルに',
  'tour.maker.lead':
    'カラオケタブの中にある本格的な制作スタジオです。すべてを自動でこなせます: 音楽からボーカルを分離し、ローカルの音声モデルで歌詞とタイミングを読み取り、メロディーの音符を検出します。あるいは、ズームできるタイムライン上で、タップ、録音、手描きで一つひとつのタイミングを打ち込めます。すべてこのコンピューター上で動きます。',
  'tour.maker.point1':
    '「この曲を自動で準備する」: ボーカルを分離し、続いて歌詞とタイミングを読み取ります。バックグラウンドで続行も可能です。',
  'tour.maker.point2':
    '分離したトラックを保持: ボーカルと伴奏をそれぞれ保存でき、MP3 でも書き出せます。',
  'tour.maker.point3':
    '細部のための手動ツール: 歌詞をタップ、行の開始位置を記録、開始と長さを持つ単語インスペクター、単語の音節分割。',
  'tour.maker.point4':
    'ピッチグリッドにメロディーを描き、ゴールデンノートを付け、FluidEQ プロジェクト、UltraStar TXT、LRC、拡張 LRC、伴奏トラックとして書き出します。',
  'tour.maker.how':
    'カラオケで曲を読み込み「作成」を押します。ウィザードで「自動で準備」を受け入れ、タイムラインで歌詞を直し、「プレーヤーで使用」そして「書き出す」を押します。',
  'tour.maker.open': 'カラオケを開く',

  'tour.media.kicker': 'ウェブを、あなたの EQ を通して',
  'tour.media.title': 'オンラインメディア',
  'tour.media.subtitle': 'YouTube、YouTube Music、Bandcamp、Twitch、Suno',
  'tour.media.lead':
    'ストリーミングサイト用の内蔵プレイヤー。オンラインで観るもの、聴くものが別のブラウザーではなくあなたの EQ を通ります。5 つのサイトがそれぞれの検索付きで組み込まれ、外部へ向かうリンクは「ブラウザで開く」の選択で止まります。',
  'tour.media.point1':
    '開いているサイトを検索する一つの検索欄。最近の検索は消去できます。',
  'tour.media.point2':
    'ログインは一度だけ: ログアウトするまで、プレイヤーは次に訪れたときもログインを保ちます。',
  'tour.media.point3':
    '再開: プレイヤーは最後のページと見ていた位置を覚えていて、そこへ戻します。',
  'tour.media.point4':
    '進行状況ピル付きのダウンロードと、完了後の「フォルダーに表示」。ツールバーの端にあるドアの形のログアウトボタンは、Cookie とログインを一度に消します。',
  'tour.media.how':
    '「オンラインメディア」タブを開き、上の列からサイトを選び、検索欄に入力して検索を押します。戻る、進む、再読み込みはブラウザーと同じです。',
  'tour.media.open': 'オンラインメディアを開く',
  'tour.studio.free': 'すべてのアカウントで無料',
};

export default tour;
