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
    'タイトルバーのスイッチ一つで、FluidEQ 全体がプレーヤーに収まります。LED 時計、ランプ、イコライザー一式を備えたクラシックアンプです。「{backdrop}」では Plus ビジュアライザーの上でガラスに変わります。同じスイッチで、離れたページに戻れます。',
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
    'パネルは新しいアイコンの色で、ひとつながりの広いフロアに並びます。「{brightness}」スライダー 1 本で、ウィンドウ全体がほぼ黒から明るいオーシャンブルーまで変わります。グラフに Plus ビジュアライザーがあれば、ウィンドウはその色をまとうことも、すべての背後でそれを再生することもできます。',
  'tour.look.point1':
    '「{brightness}」はパルスアイコンのメニューにあり、「{windowColours}」では「{transparency}」と並んでいます。',
  'tour.look.point2':
    '「{windowColours}」には「{original}」「{colours}」「{ambient}」「{backdrop}」があり、それぞれウィンドウへの効果が一行で書かれています。',
  'tour.look.point3':
    'ダイアログとメニューは同じ素材になり、「{rainbow}」はアイコンの色、またはビジュアライザー自身の色で流れます。',
  'tour.look.how':
    '右上のパルスアイコンの「オーディオ操作」メニューで「{brightness}」を動かします。グラフに Plus ビジュアライザーがあるときは、グラフのバーから「{windowColours}」を開き、「{backdrop}」を選びます。',
  'tour.look.open': 'EQ を開く',
  'tour.look.imageAlt':
    'パネルの背後に夜の山のシーンが映る FluidEQ と、「背景」を選び、「明るさ」を半分、「透明度」を 4 分の 1 にした「ウィンドウの色」メニュー。',
  'tour.gpu.kicker': '新しいビジュアライザーエンジン',
  'tour.gpu.title': 'すべてのビジュアライザーをグラフィックカードで',
  'tour.gpu.subtitle': '40 の表示を画面の速さで、そして 3D の世界',
  'tour.gpu.lead':
    'グラフの 40 の表示は、Plus シーンと同じエンジンで描かれるようになりました。グラフィックカード上で、画面そのもののリフレッシュレートで動くので、バーや粒子やピークがカクつかずに滑らかに動きます。さらに Plus ビジュアライザーは本物の 3D の世界にもなれます。',
  'tour.gpu.point1':
    '「{scenes}」に新しい表示が 18 種類。「{synthwave}」「{horizon}」「{towers}」「{ledwall}」など。自前の色を持たない表示はウィンドウの色をまといます。',
  'tour.gpu.point2':
    '3D の世界はキックで踏み込み、スネアで揺れ、ドロップで跳ね、「{brightness}」に合わせて夜から昼へ移ります。ドラッグすると別の角度から見られます。',
  'tour.gpu.point3':
    '表示の切り替えは次の表示へフェードし、ウィンドウが隠れている間、3D の世界はグラフィックメモリを返します。',
  'tour.gpu.how': 'グラフ上の表示名をクリックし、「{scenes}」から選びます。',
  'tour.gpu.open': 'EQ を開く',
  'tour.gpu.imageAlt':
    '夜の 3D 都市の Plus ビジュアライザーと、グラフ上で撮影した 4 つの新しい表示（「{synthwave}」「{horizon}」「{towers}」「{ledwall}」）。最初の画像では表示の選択を丸で囲んでいます。',
  'tour.gpu.world': '3D の世界',
  'tour.sparks.kicker': 'ポインターの火花',
  'tour.sparks.title': 'マウスに応えるビジュアライザー',
  'tour.sparks.subtitle': 'ポインターから火花、花びら、雪',
  'tour.sparks.lead':
    'Plus ビジュアライザーの上でマウスを動かすと、火花、花びら、雪、残り火など、そのシーンを形づくるものがポインターの後に軌跡を描き、クリックした場所ではじけます。「{ambient}」と「{backdrop}」では、鳥や花びらや光がウィンドウ全体にも漂います。',
  'tour.sparks.point1':
    'ビジュアライザーごとに飛ぶものが違います。冬のシーンなら雪、たき火なら火の粉、庭なら花びら。',
  'tour.sparks.point2':
    'Studio のステージでは常に表示されるので、シーンの作者は飛ばすものを作り込めます。',
  'tour.sparks.point3':
    'すべてのビジュアライザーに共通のスイッチ一つ：「{windowColours}」の「{rainbow}」の下にある「{sparks}」。',
  'tour.sparks.how':
    'グラフに Plus ビジュアライザーがあるときに、その上でマウスを動かしてクリックします。「{sparks}」は「{windowColours}」の「{rainbow}」の下にあります。',
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
    'グラフの「アナライザー」: 80 dB の深さの再生中のスペクトル、その背後の 1/3 オクターブのバーと上のピーク、いちばん上の EQ カーブ、そして「解析」に並ぶ 12 のビュー。',

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
  'tour.studio.subtitle': '15 日間無料、または 1 か月分を獲得',
  'tour.studio.lead':
    'スタジオは、アイデアを音楽に合わせて動くシーンに変えます。現在は Plus の一部で、新しいアカウントなら 15 日間無料で試せます。カードは不要で、体験が終わっても課金されません。',
  'tour.studio.point1':
    'シーンはすべてギャラリーに載る前に審査され、承認されると次の 1 か月の Plus が無料になります。',
  'tour.studio.point2':
    'シーンは本物の 3D ワールドにでき、キックに合わせて踏み込み、ドロップで跳ね上がります。',
  'tour.studio.point3':
    'AI 用のプロンプトをコピーすると、AI アシスタントがシーンを見て、曲の動きを聴き取れます。',
  'tour.studio.how':
    '「Plus」を開き、レールで「スタジオ」を選びます。Plus がない場合は、そのページから無料体験を始められます。',
  'tour.studio.open': 'Plus を開く',
  'tour.studio.imageAlt':
    'スタジオで作った山々の上のオーロラ、その元になったアイデア、15 日間の無料体験、そして承認されたシーンで得られる 1 か月分。',
  'tour.studio.idea':
    '山の湖の上に広がるオーロラ。低音でオーロラがふくらみ、ビートに合わせて星がまたたく。',
  'tour.studio.earned': '承認済み: 翌月は無料',
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
  'tour.plus.title': 'FluidEQ Plus へようこそ',
  'tour.plus.subtitle': 'ビジュアライザー、スタジオ、ライティングなど',
  'tour.plus.lead':
    'FluidEQ の成長を支える任意のメンバーシップです。専用の新しいタブには、グラフィックスカードで描くシーン、自分のシーンを作れるスタジオ、ランキング、デスクトップの背景、ダイナミック ライティングがそろっています。イコライザー、ラック、プレーヤーは、これまでどおり無料のままです。',
  'tour.plus.point1':
    '「オーディオ操作」メニューの「アカウント」からサインインします。支払いはブラウザーで行い、Plus は自動で有効になります。',
  'tour.plus.point2':
    '月払いと年払いから選べ、支払いの前にわかりやすい言葉で書かれた規約を読めます。アプリがカード情報を見ることはありません。',
  'tour.plus.point3':
    '最大 5 台のコンピューターでサインインでき、新しいビジュアライザーも順次追加されます。',
  'tour.plus.how':
    '「Plus」タブを開きます。左側に「ランキング」「ビジュアライザー」「スタジオ」「ダイナミック ライティング」が並んでいます。',
  'tour.plus.open': 'Plus を開く',
  'tour.plus.imageAlt':
    'Plus タブ。横にランキング、ビジュアライザー、スタジオ、ダイナミック ライティングが並び、ビジュアライザーのギャラリーにクローム、ブルーム、オーロラ、アルプス、ネオンシティが表示されています。',
  'tour.scene.alpine': 'アルプス',
  'tour.scene.aurora': 'オーロラ',
  'tour.scene.bloom': 'ブルーム',
  'tour.scene.chrome': 'クローム',
  'tour.scene.neonCity': 'ネオンシティ',

  'tour.visualizers.kicker': 'ビジュアライザー',
  'tour.visualizers.title': '音楽に合わせて動くシーン',
  'tour.visualizers.subtitle': 'グラフィックスカードで描画',
  'tour.visualizers.lead':
    'Plus ビジュアライザーは、星空の下の山々、オーロラのカーテン、ネオンの街といった生き生きと動くシーンを、グラフィックスカードで EQ カーブの下に描きます。低音、ビート、高音がそれぞれ別のものを動かし、周りのウィンドウをシーンの色に染めることもできます。',
  'tour.visualizers.point1':
    'すべてを一つの選択欄から。形と色を変えられる {styles} の無料スタイルと、カテゴリ別の Plus ビジュアライザー。',
  'tour.visualizers.point2':
    'ギャラリーを見て回り、FluidEQ のサンプルを 10 秒間試して、気に入ったシーンを追加できます。',
  'tour.visualizers.point3':
    'ビジュアライザーの自動切り替えや全画面表示ができ、シーンのアタックとリリースは「表示」メニューで設定できます。',
  'tour.visualizers.how':
    'グラフ上の表示の名前をクリックして「Plus ビジュアライザー」からシーンを選ぶか、「Plus → ビジュアライザー」ですべてを見て回ります。',
  'tour.visualizers.open': 'EQ を開く',
  'tour.visualizers.imageAlt':
    '夜の湖の向こうにそびえる山々を描いた Plus ビジュアライザー「アルプス」が、グラフの EQ カーブの下で再生され、その下にさらに 4 つのシーンが並んでいます。',

  'tour.desktop.kicker': 'デスクトップ ビジュアライザー',
  'tour.desktop.title': 'デスクトップの背景に、あなたの音楽を',
  'tour.desktop.subtitle': 'モニターごとにシーンを',
  'tour.desktop.lead':
    'Plus ビジュアライザーをデスクトップアイコンの背面に置けます。聴いている音楽に合わせて、または穏やかに単独で動き、モニターごとに別のシーンを映せます。',
  'tour.desktop.point1':
    'デスクの配置図でモニターを選び、それぞれに別のビジュアライザーを設定できます。',
  'tour.desktop.point2':
    'ウィンドウがモニターを覆っている間、PC のロック中、バッテリー駆動中は一時停止します。',
  'tour.desktop.point3': '次に FluidEQ を起動すると、自動で再開します。',
  'tour.desktop.how':
    'グラフに Plus ビジュアライザーを表示し、名前の横にあるモニターのボタンを押すか、「表示 → デスクトップの背景に設定」を選びます。',
  'tour.desktop.open': 'EQ を開く',
  'tour.desktop.imageAlt':
    '3 台のモニター。それぞれのデスクトップアイコンとタスクバーの背後に、Plus ビジュアライザーのオーロラ、アルプス、ネオンシティが映っています。',

  'tour.lighting.kicker': 'ダイナミック ライティング',
  'tour.lighting.title': 'シーンに合わせてデスクが光る',
  'tour.lighting.subtitle': 'ベータ · RGB デバイスがビジュアライザーに連動',
  'tour.lighting.lead':
    'Windows Dynamic Lighting と Razer Chroma を通して、キーボード、マウス、マウスパッド、ヘッドセット、スタンドが、グラフ上の Plus ビジュアライザーの色をまとい、そのリズムに合わせて光ります。',
  'tour.lighting.point1':
    'ビジュアライザーごとに 4 つのスタイル: シーン、カラーウェーブ、スペクトル、ビートの波紋。',
  'tour.lighting.point2':
    'デバイスを 1 台ずつ調整でき、音楽が止まったときの動作も選べます。',
  'tour.lighting.point3':
    'ライブプレビューには、光っているあなたのデスクがそのまま描かれます。ベータ版なので、お使いのデバイスでの動作をぜひお知らせください。',
  'tour.lighting.how':
    '「Plus → ダイナミック ライティング」を開いてオンにし、グラフに Plus ビジュアライザーを表示します。',
  'tour.lighting.open': 'Plus を開く',
  'tour.lighting.imageAlt':
    'ネオンシティのピンク、バイオレット、シアンに光るキーボード、マウス、マウスパッド。',

  'tour.share.kicker': 'すべての PC を聴く',
  'tour.share.title': 'コンピューター間で音声を共有',
  'tour.share.subtitle': 'ヘッドセット一つで、机の上のすべてのマシンを',
  'tour.share.lead':
    'ゲーミング PC、仕事用ノート、メディアボックスの音が、今かけているヘッドセット一つに集まります。自分のネットワーク上で、ロスレス、暗号化、そして調整済みの EQ を通して。',
  'tour.share.receiverLabel': '受信側',
  'tour.share.receiverName': 'ヘッドセットをつないだ PC',
  'tour.share.senderLabel': '送信側',
  'tour.share.senderName': 'そのほかのすべての PC',
  'tour.share.wireLabel': 'ロスレス · 暗号化 · プライベート LAN',
  'tour.share.stepsTitle': '3 ステップで設定',
  'tour.share.step1Title': 'ヘッドセット側の PC でコードを作成',
  'tour.share.step1':
    '「音声を共有」タブを開き、「このコンピューターで音声を再生」を選んで「接続コードを作成」を押します。自分のネットワーク用のコードをコピーします。',
  'tour.share.step2Title': 'ほかの各 PC でコードを貼り付け',
  'tour.share.step2':
    'その PC で FluidEQ を開き、「音声を共有」で「このコンピューターの音声を送信」を選び、コードを貼り付けてから「接続して送信」を押します。システム音声が加工されないまま流れ始め、エフェクトは聴いている側のコンピューターでかかります。',
  'tour.share.step3Title': '聴きながら音量を調整',
  'tour.share.step3':
    '各送信側は短いバッファで再生し、途切れても自動で追いつきます。各送信側の音は受信側の出力にミックスされ、その EQ で整えられます。受信側の再生バーには最新の送信元の曲が表示され、そのボタンはネットワーク越しに動作します。',
  'tour.share.fact1Title': 'ロスレス',
  'tour.share.fact1':
    '端から端まで Float32 PCM。メディアコーデックなし、世代劣化なし。',
  'tour.share.fact2Title': '暗号化',
  'tour.share.fact2':
    'すべてのパケットを AES-256-GCM で暗号化。コードが鍵であり、持たない人は聴けません。',
  'tour.share.fact3Title': 'ペアリングを保持',
  'tour.share.fact3':
    'ペアリングはアプリの終了や再起動を越えて残ります。切れるのは新しいコードを作成したときだけです。',
  'tour.share.tip':
    '小さな音量から。複数の PC はすぐに足し合わさります。最初の接続前にヘッドセットの音量を下げてください。',
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
    'デバイスの下にあるEQプロファイル選択欄から、保存済みプロファイルを選べます。メイン出力の調整はそのままです。',
  'tour.output.point3':
    '「再生はひとつだけ」: FluidEQ で何かを再生するとマシンの他の再生が止まり、逆も同じです。',
  'tour.output.point4':
    'ゲーム/動画は約30 msのバッファで開始し、途切れた後に同期を取り戻します。音楽は約100 msから開始して滑らかな再生を優先します。デバイスのバッファによる遅延も加わります。',
  'tour.output.how':
    'EQタブの右側で「2 つめの出力」を開きます。デバイスをオンにして名前の下のEQプロファイルを選び、音量とゲーム/動画または音楽を設定します。',
  'tour.output.open': 'EQ を開く',
  'tour.output.imageAlt':
    'BlackShark V2 Proが有効な「2 つめの出力」パネル。EQプロファイル選択欄、音量スライダー、ゲーム/動画と音楽のモードが表示されています。',

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
};

export default tour;
