// 2.4 の新機能（`renderer/components/featureTour/release24.tsx`）。
const tour24 = {
  'tour.animations.kicker': 'スタジオ · アニメーション',
  'tour.animations.title': '動く画像を、1 コマずつ確かめて',
  'tour.animations.subtitle': 'シーンのアニメーションを 1 コマずつ',
  'tour.animations.lead':
    'シーンのチャットに画像を動かすよう頼めます。画像を曲げて写真のままのコマにするか、あなたの Claude が使えるものを使い、シートに並べて全コマを確かめます。',
  'tour.animations.point1':
    '地面・空・水の上で、上り坂でも下り坂でも、好きな速さで、1 コマずつ、またはスタジオ全体に大きく再生できます。',
  'tour.animations.point2':
    'シート、アトラス JSON、GIF、APNG、WebP、Aseprite ファイル、連番画像を取り込めます。追加する前にタブで再生して確かめられます。',
  'tour.animations.point3':
    '新しいプロジェクトは、オーブの中の月とその上を飛ぶツバメから始まります。画像とアニメーションの仕組みを初日から学べます。',
  'tour.animations.how':
    'シーンを開いてスタジオに進み、ステージの下のアニメーションを選びます。チャットにシーンの画像を動かすよう頼んでください。',
  'tour.animations.open': 'シーンを開く',
  'tour.animations.imageAlt':
    'スタジオのアニメーションタブ。空の背景で羽ばたくツバメと、帯に並んだ 8 コマ。その下でシーンのチャットが跳ねるコマを見つけています。',
  'tour.animations.task': 'ツバメの飛び方を 1 コマずつ確かめて。',
  'tour.animations.stepLook': '{count} コマすべてを並べて確認',
  'tour.animations.stepJump': '{frame} コマ目が他より跳ねています',
  'tour.animations.stepFix': '{frame} コマ目を他とそろう位置に戻しました',
  'tour.animations.reply':
    '飛び方がなめらかになりました。どのコマも同じ線の上にあります。',
  'tour.pictures.kicker': 'スタジオ · 画像',
  'tour.pictures.title': '画像を見て、描き込んで、送り返す',
  'tour.pictures.subtitle': 'チャットの画像を拡大・コピーして描き込める',
  'tour.pictures.lead':
    'AI が開いたり扱ったりする画像は、すべてチャットに表示されます。クリックすると大きく開き、好きなだけ拡大できます。',
  'tour.pictures.point1':
    '拡大したその場所に描き込めます。丸で囲む、矢印で示す、文字を書く、大事な部分だけ切り抜く。そのまま次のメッセージに添付できます。',
  'tour.pictures.point2':
    'どの画像もボタン、Ctrl+C、右クリックでコピーして、好きな場所に貼り付けられます。',
  'tour.pictures.point3':
    '描き込みは画像と一緒に届くので、AI はあなたの意図をそのまま理解します。',
  'tour.pictures.how':
    'スタジオのチャットで画像をクリックして開き、描き込むで印を付けてから、チャットに添付を押します。',
  'tour.pictures.open': 'シーンを開く',
  'tour.pictures.imageAlt':
    '大きく開いて拡大した月の画像。クレーターを囲む丸、矢印、文字が描かれ、切り抜き枠が狭まり、画像をコピーとチャットに添付のボタンがあります。下には画像が届いたチャット。',
  'tour.pictures.ask': 'この月をオーブに入れて、縁を光らせて。',
  'tour.pictures.reply': 'できました。縁が光り、画像タブにも入っています。',
  'tour.pictures.mark': 'もっと明るく',
  'tour.pictures.followUp': 'このクレーターを低音で光らせて。',

  'tour.stage.kicker': 'スタジオ · ステージ',
  'tour.stage.title': '実際に表示される場所でシーンを試す',
  'tour.stage.subtitle':
    'ウルトラワイドのグラフ、コンパクトプレーヤー、穏やかと音楽',
  'tour.stage.lead':
    'ステージは、みんなが見るのと同じ形でシーンを映します。ウルトラワイドのグラフとして、またはコンパクトプレーヤーの列に、曲名と操作ボタンを重ねて。',
  'tour.stage.point1':
    'ステージを拡大して動き回れます。AI にはステージに映っているものがそのまま渡るので、「ここ」と言えば本当にそこです。',
  'tour.stage.point2':
    'ステージのボタンを 1 回押すだけで、音楽を「穏やか」に切り替えます。デスクトップ背景が再生する、ゆっくりしたアニメーションです。',
  'tour.stage.point3':
    '何も再生していないときはデモ曲に合わせて動くので、作業中にシーンが止まることはありません。',
  'tour.stage.how':
    'スタジオで、ステージのサイズメニューから形を選びます。音楽と穏やかのボタンはステージ上にあります。',
  'tour.stage.open': 'シーンを開く',
  'tour.stage.imageAlt':
    'スタジオのステージに映る Alpine シーン。拡大しながら AI に見える範囲を枠で示し、音楽と穏やかのボタンがあります。隣には同じシーンのウルトラワイドのグラフと、操作ボタンを重ねたコンパクトプレーヤー。',
  'tour.stage.agentSees': 'AI に見える範囲',

  'tour.ai.kicker': 'スタジオ · あなたの AI',
  'tour.ai.title': 'すべてのシーンに取り組む AI',
  'tour.ai.subtitle':
    '複数のシーンを同時に、自分のプラグインで、好きなモデルで',
  'tour.ai.lead':
    'AI は複数のシーンに同時に取り組めるようになりました。シーンごとに専用のチャットがあり、Claude プランの消費も少なくなりました。',
  'tour.ai.point1':
    'あなたの Claude にあるもの、つまりプラグイン、ツール、コマンドで作業し、新しいものを使う前には確認します。',
  'tour.ai.point2':
    '3D ワールド、3D 写真、アニメーションのための FluidEQ 独自のスキルがアプリに同梱され、常に最新です。',
  'tour.ai.point3':
    'チャットごとにモデルと労力を選べます。一覧は Claude Code に連動するので、新しいモデルも出てすぐに表示されます。',
  'tour.ai.how':
    'スタジオでシーンを開き、そのチャットに書き込みます。モデルと労力は入力欄の下にあります。',
  'tour.ai.open': 'シーンを開く',
  'tour.ai.imageAlt':
    '同時に作業中の 3 つのシーン。2 つは進行中、1 つはバージョン 7 として保存済み。その下に FluidEQ のスキル。隣には AI が使うものと、モデルと労力のメニュー。',
  'tour.ai.skills': 'FluidEQ のスキル',
  'tour.ai.skillWorlds': '3D ワールド',
  'tour.ai.skillPhotos': '3D 写真',
  'tour.ai.skillAnimation': 'アニメーション',
  'tour.ai.claudeTitle': 'あなたの Claude で作業',
  'tour.ai.claudePlugins': 'あなたのプラグイン',
  'tour.ai.claudeTools': 'あなたのツールとコマンド',
  'tour.ai.claudeAsks': '新しいものは使う前に確認',
  'tour.controls.kicker': 'シーン',
  'tour.controls.title': '自分好みに仕上げられるシーン',
  'tour.controls.subtitle':
    'パレット、選択肢、3D ワールド、保存されるバージョン',
  'tour.controls.lead':
    'シーンは、カラーパレット、アイコン付きの選択肢、単色、そしてそれを使う選択肢のときだけ現れる調整項目を提供できるようになりました。',
  'tour.controls.point1':
    '3D ワールドには曲がった円柱や円錐、本物の床が加わり、シーンはデモ曲に合わせた昼間の、より鮮明なプレビュー動画付きで公開されます。',
  'tour.controls.point2':
    '公開画面にシーンの容量が表示されます。バージョンが上がるのは公開したときだけで、ステータス行に今のバージョンが表示されます。',
  'tour.controls.point3':
    'ギャラリーは各シーンの直近 10 バージョンを保管し、シーンのページからどれでもこのコンピューターに保存できます。',
  'tour.controls.how':
    'スタジオでシーンの調整タブを開きます。シーンのバージョンはギャラリーのそのページにあります。',
  'tour.controls.open': 'シーンを開く',
  'tour.controls.imageAlt':
    '2 つのカラーパレットと、晴れ・雨・雪と切り替わる天気の選択肢がある調整タブ。雪のときだけ降雪量のスライダーが現れます。隣にはシーンのページと、そのサイズ、バージョン、保存されたバージョン。',
  'tour.controls.weather': '天気',
  'tour.controls.clear': '晴れ',
  'tour.controls.rain': '雨',
  'tour.controls.snow': '雪',
  'tour.controls.glow': '月の輝き',
  'tour.controls.snowfall': '降雪量',

  'tour.camera.kicker': 'シーン',
  'tour.camera.title': 'グラフでもデスクトップでも、シーンの中を動き回る',
  'tour.camera.subtitle': '自分のカメラキーと、マウスに応えるデスクトップ',
  'tour.camera.lead':
    '3D シーンのカメラを動かすキー（Ctrl、Alt、Shift、または好きなキー）と、押したままドラッグするか、押したまま動かすだけかを選べます。',
  'tour.camera.point1':
    '「マウスに追従」をオンにするとシーンがポインターの方へ傾き、「自動で回る」に任せることもできます。視点をリセットはキーを押している間だけ表示されます。',
  'tour.camera.point2':
    'デスクトップのシーンは、何もないデスクトップ上のマウスに反応します。モニターごとに時刻を持ち、スタジオは最新バージョンをデスクトップに設定します。',
  'tour.camera.point3':
    'ビートのフラッシュはキックに合わせて光り、何も再生していないときギャラリーのプレビューはデモ曲で動き、壊れたシーンはシンプルな見た目ではなく最後に動いたバージョンを再生します。',
  'tour.camera.how':
    'カメラの設定は、グラフの表示メニューのシーンの下にあります。',
  'tour.camera.open': 'EQ を開く',
  'tour.camera.imageAlt':
    'それぞれのデスクトップにシーンを映した 2 台のモニター。1 台目ではシーンがポインターの方へ傾き、Ctrl を押している間だけ視点をリセットが表示されます。どちらも独自の時刻を持ち、下にはカメラの設定。',

  'tour.v24.also': '2.4 のその他の更新',
  'tour.v24.heroes':
    'Heroes of the Storm に、オプションのワイドステージ付きの、より厚みのある専用ミックスが加わり、ゲームフィルターは合図を目立たせながら音楽をより安定させます。',
  'tour.v24.graphSettings':
    'グラフは標準の見た目とシーンで、別々の設定を保ちます。',
  'tour.v24.colourful': 'カラフルモードはグラフのシーンの色を使います。',
  'tour.v24.gallery': 'ギャラリーは新着シーンから開きます。',
  'tour.v24.credits': 'ブラウザーで購入したクレジットは自動で届きます。',
  'tour.v24.sponsors':
    '「このアプリについて」やサポートページから、GitHub Sponsors で FluidEQ を支援できます。',
  'tour.v24.crashes':
    '万一 FluidEQ がクラッシュしても、記録はこのコンピューターにだけ残り、送るかどうかはあなたが決めるバグレポートに使えます。',
  'tour.visualsTitle': 'シーンの新機能',
  'tour.rail.alwaysVisuals': 'シーンのその他の機能',
  'visuals.news.open': '新機能',
  'visuals.news.blurb': 'シーン、スタジオ、ライティング',
  'visuals.news.title': 'シーン {version} の新機能',
  'visuals.news.see': '新機能を見る',
  'visuals.news.later': '後で',

  'tour.level.kicker': 'DSP プリセット',
  'tour.level.title': '曲そのままの音量で鳴るプリセット',
  'tour.level.subtitle': '急に大きくならず、音量が保たれる',
  'tour.level.lead':
    '工場出荷の DSP プリセットは、各ステージの前で曲の音量をそろえなくなりました。各ステージは届いたままの音楽を聴き、マキシマイザーが固定ゲインを加えてピークを抑えます。',
  'tour.level.point1':
    '再生中にゲインを調整するプリセットから切り替えても、その持ち上げが次の音に持ち越されなくなりました。',
  'tour.level.point2':
    '一時停止のあとも急に大きくなりません。無音のあと、曲はそれ自身の音量で戻ってきます。',
  'tour.level.point3':
    'EQ のプリアンプの自動ノーマライズは、Windows が出力を開き直しても、最初からやり直さずに音量を保ちます。',
  'tour.level.how':
    'すでにあるラックは、DSP ページでその工場出荷プリセットを選び直すまで設定を保ちます。',
  'tour.level.open': 'DSP を開く',

  'tour.edit.kicker': 'スタジオ · 編集モード',
  'tour.edit.title': 'シーンの中のものを手で動かす',
  'tour.edit.subtitle':
    'ロックを外すまですべて固定、保存するまで何も残りません',
  'tour.edit.lead':
    'ステージで「編集」を押し、3D シーンの中のものを選びます。形、ライト、3D モデル、グループ。最初はすべてロックされているので、うっかり動くことはありません。鍵を一度押せば外れます。',
  'tour.edit.point1':
    'ハンドルで移動・回転・サイズ変更。「スナップ」で 4 分の 1 刻みと 15° 刻みに。スペースを押したままでキャンバスを動かせます。編集モードは「ウルトラワイドのグラフ」や「コンパクトプレーヤー」を含む、ステージのどの表示でも開いたままです。',
  'tour.edit.point2':
    'すべてが一つのリストにあり、検索、名前変更、グループ化、ロック、ソロ、非表示ができます。ソロと非表示は作業用で、聴く人に見えるシーンは変わりません。ソロはグループの中でも印が付きます。',
  'tour.edit.point3':
    '「保存」を押すまでシーンは変わりません。「破棄」で変更を捨て、元に戻す・やり直しで行き来できます。',
  'tour.edit.how':
    'スタジオで 3D シーンを開き、そのステージで「編集」を押します。',
  'tour.edit.open': 'シーンを開く',
  'tour.edit.imageAlt':
    'スタジオのステージ上のシーン。形がひとつ選ばれ、鍵が開いてハンドルが出ています。上に移動・回転・サイズのツール、横にリストがあり、ほかはすべてロックされ、選んだ形だけが表示されています。',
  'tour.watch.kicker': 'スタジオ · あなたの AI',
  'tour.watch.title': 'シーンの動きを見る AI',
  'tour.watch.subtitle': '音楽に沿ったフレーム、三つの表示、曲',
  'tour.watch.lead':
    'AI はもう 1 枚の絵だけでシーンを判断しません。動きを見て、聴く人に見える形で確かめます。',
  'tour.watch.point1':
    '音楽に沿ったいくつかのフレームを並べ、ものがどちらへ動くか、均一に動くかを見ます。',
  'tour.watch.point2':
    '通常のグラフ、ウルトラワイドのグラフ、コンパクトプレーヤーの列全体を同じ瞬間に。切れたり黒く残ったりしないように。',
  'tour.watch.point3':
    'テスト曲の 6 つの瞬間を無音からドロップまで見て、ドロップが目に見えるか、デイライト 0 で夜がどれだけ暗いかを確かめます。',
  'tour.watch.how':
    'シーンのチャットに変更を頼んでください。毎回この方法で仕上がりを確かめます。',
  'tour.watch.open': 'シーンを開く',
  'tour.watch.imageAlt':
    '音楽に沿ったシーンの 5 フレームと動き方、通常・ウルトラワイド・コンパクトプレーヤー表示のシーン、無音からドロップまでのテスト曲の 6 つの瞬間。',
  'tour.watch.frames': '音楽に沿ったフレーム',
  'tour.watch.moves': '右へ、均一に動く',
  'tour.watch.standard': '通常',
  'tour.watch.song': '曲でチェック',
  'tour.watch.silence': '無音',
  'tour.watch.verse': 'Aメロ',
  'tour.watch.build': 'ビルド',
  'tour.watch.drop': 'ドロップ',
  'tour.watch.dropShows': 'ドロップが見える',
  'tour.watch.night': '夜: 明るさ {value}%',
  'tour.makers.kicker': 'スタジオ · 画像',
  'tour.makers.title': 'Higgsfield と連携',
  'tour.makers.subtitle': 'シーンのための画像とアニメーション',
  'tour.makers.lead':
    'スタジオの AI が Higgsfield で、シーンのための画像とアニメーションを作ります。',
  'tour.makers.point1':
    'あなた自身の Higgsfield アカウントを使います。チャットのアカウントで一度設定するだけです。',
  'tour.makers.point2':
    '何かを作る前に、費用を伝えて、まずあなたに確認します。',
  'tour.makers.point3': '作った動画は、シーンのアニメーションになります。',
  'tour.makers.how':
    'スタジオでシーンのチャットを開き、「アカウント」を押します。',
  'tour.makers.open': 'シーンを開く',
  'tour.makers.imageAlt':
    'アニメーションを作る前に Higgsfield の許可を求めるシーンのチャットと、Claude と Higgsfield が並ぶアカウント一覧。',
  'tour.makers.request': '鯉が泳ぐアニメーションにして',
  'tour.code.kicker': 'スタジオ · コード',
  'tour.code.title': 'シーンのすべてのファイルを「コード」タブで編集',
  'tour.code.subtitle':
    'シェーダー、ワールド、マテリアル、アニメーション。保存の前に毎回チェック',
  'tour.code.lead':
    '「コード」タブはシーン全体を表示し、そのまま編集できます。シェーダー、3D ワールドとそのマテリアル、アニメーション。どれも勝手には保存されない下書きです。メモは 2 つのシンプルな欄です。',
  'tour.code.point1':
    '編集は入力しながら、AI の保存と同じルールでチェックされます。問題はその行のあとに示され、直すまで「保存」は押せません。',
  'tour.code.point2':
    'チェックを通った編集は保存する前にステージで再生され、「元に戻す」「やり直す」「破棄」で変更をたどれます。',
  'tour.code.point3':
    'AI が保存するたびにファイルを追い、AI がふつうの画像として詰めたコマ割りシートは本物のアニメーションになります。',
  'tour.code.how':
    'スタジオでシーンを開き、ステージの下で「コード」を選びます。',
  'tour.code.open': 'シーンを開く',
  'tour.code.imageAlt':
    '「コード」タブ。シーンのファイルは名前までたたまれ、3D ワールドのマテリアルがひとつ開いて編集され、変えた行に印があり、上に「保存できます」と「保存」があります。',
  'tour.fullscreen.kicker': 'スタジオ · 全画面',
  'tour.fullscreen.title': '全画面でシーンを作る',
  'tour.fullscreen.subtitle': '再生中のシーンの横に、作業パネルとチャット',
  'tour.fullscreen.lead':
    '全画面では、作業パネルとチャットが空けた部分でシーンが再生を続け、パネルが出入りしたりサイズが変わったりするたびに収まり直します。編集モードと同じようにズームやパンができ、全体表示で元に戻せます。',
  'tour.fullscreen.point1':
    '作業パネルには「調整」「コード」などすべてのタブがあります。上の端をドラッグすれば高さを変えられます。',
  'tour.fullscreen.point2':
    'どちらも全画面のコントロールか、それぞれの右上にあるボタンで出し入れでき、作業パネルは Ctrl+J、チャットは Ctrl+L でも切り替えられます。',
  'tour.fullscreen.point3':
    'チャットの端をドラッグすると幅を広げたり狭めたりでき、次の全画面は前回の状態で開きます。',
  'tour.fullscreen.how':
    'スタジオでシーンを開き、ステージの「全画面」を押します。',
  'tour.fullscreen.open': 'シーンを開く',
  'tour.fullscreen.imageAlt':
    '全画面で、空いた部分にシーンが再生され、その下に「調整」タブの作業パネルが開き、右側にシーンのチャットがドッキングされています。',
  'tour.fullscreen.request': 'ドロップでオーロラをもっと明るくして',
  'tour.v25.also': '2.5 のその他の更新',
  'tour.v25.recover':
    'デスクトップ背景やコンパクトプレーヤーは、ビルドできないシーンをスタジオのプロジェクトかギャラリーのコピーから直します。',
  'tour.v25.never':
    '再生できないシーンが別の見た目に置き換わることはありません。グラフが理由を示し、「再試行」を出します。',
  'tour.v25.painted':
    '描かれたシーンでは、AI に伝えたい場所を示すピンと枠を手で動かせます。どこへでもドラッグでき、枠は角や辺を引いて大きさを変え、ボタンか Delete で消せます。',
  'tour.v25.views':
    '公開では送る前にシーンを通常、ウルトラワイド、コンパクトプレーヤーで再生でき、「グラフで再生」なら1回の操作でグラフ上で試せます。',
  'tour.v25.review':
    '承認されなかったシーンには、名前の横に審査の理由が表示されます。',
  'tour.v25.publish': '公開に月ごとの上限はありません。',
  'tour.film.visuals.intro': 'ビジュアルのすべてを、1本の映像で',
  'tour.v25.film.body':
    'ライブラリーとカラオケ、シーン、ギャラリーとクレジット、デスクトップの背景、デバイスのライティング、スタジオを、実際の画面で紹介します。',
  'tour.v25.film.soon':
    'この映像はまもなく公開されます。準備ができしだい、ここで再生できます。',
  'tour.signed.kicker': 'FLUIDEQ 2.5',
  'tour.signed.title': '署名付きに。そして今も無料！',
  'tour.signed.subtitle': 'ここまでの歩みと、誰でも使える署名付きの FluidEQ',
  'tour.signed.today':
    '今の FluidEQ は、パソコンで鳴るすべての音のためのイコライザーであり、あなたの音楽のためのプレーヤーであり、音楽に合わせて動くシーンです。',
  'tour.signed.liveFor': 'FluidEQ が動き出してから',
  'tour.signed.since': '{date}に開始',
  'tour.signed.roadTitle': 'ここまでの歩み',
  'tour.signed.intro':
    'FluidEQ は 2026年8月2日に始まり、最初のリリース 0.4.0 はその2日後に出ました。それ以来、Windows の中で動く独自のオーディオエンジン、聞こえるすべての音のための DSP ラック、音楽のためのライブラリとプレーヤー、ギャラリー付きのシーン、自分のシーンを作るスタジオ、そして12の言語が加わりました。開発者による署名付きのビルドは、その歩みの大きな節目です。',
  'tour.signed.thanks':
    'FluidEQ を使い、不具合を知らせ、シーンを公開し、フォーラムに書き込んでくださる皆さん、ありがとうございます。皆さん一人ひとりのおかげで、より良いものになりました。',
  'tour.signed.signedTitle': '開発者が署名',
  'tour.signed.signedBody':
    'インストーラーを実行すると、Windows に発行元として {publisher} と表示されます。',
  'tour.signed.updatesTitle': '自動でアップデート',
  'tour.signed.updatesBody':
    '新しいバージョンは自動で届き、準備ができると FluidEQ がお知らせします。設定はそのまま残ります。',
  'tour.signed.freeTitle': '誰でも無料',
  'tour.signed.freeBody':
    'FluidEQ そのものは無料で、誰にとっても同じアプリです。ギャラリーのシーンは、作った人が販売しています。',
  'tour.signed.unit.day.one': '日',
  'tour.signed.unit.day.few': '日',
  'tour.signed.unit.day.many': '日',
  'tour.signed.unit.day.other': '日',
  'tour.signed.unit.hour.one': '時間',
  'tour.signed.unit.hour.few': '時間',
  'tour.signed.unit.hour.many': '時間',
  'tour.signed.unit.hour.other': '時間',
  'tour.signed.unit.minute.one': '分',
  'tour.signed.unit.minute.few': '分',
  'tour.signed.unit.minute.many': '分',
  'tour.signed.unit.minute.other': '分',
  'tour.signed.unit.second.one': '秒',
  'tour.signed.unit.second.few': '秒',
  'tour.signed.unit.second.many': '秒',
  'tour.signed.unit.second.other': '秒',
} as const;

export default tour24;
