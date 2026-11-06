/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'ダイナミクス：小さい音と大きい音',
  'help.dynamics.intro':
    'ダイナミクスは3バンドのコンプレッサーです。小さい音を持ち上げ、大きい音を抑え、遅延は増やしません。音楽、映画、会話、ゲームごとの音に使えます。',
  'help.dynamics.steps':
    'DSP → ダイナミクスを開き、オンにしてプリセットを選びます。ゲーム用プリセットはGaming Labにあります。\n低域は150 Hz未満、中域は150 Hz～4 kHz、高域は4 kHzより上です。変えたい音がある帯域を調整します。\n持ち上げではこの下で小さい音を上げる境目、比率で強さ、最大で最大ゲインを決めます。1:1なら変化しません。\n抑えではこの上で大きい音を下げる境目、比率で抑える強さを決めます。しきい値を下げるほど頻繁に働きます。\nアタックとリリースで反応、ミックスで原音との混合、メイクアップで仕上がりの音量を調整します。同じくらいの音量で比較してください。\nグラフには処理前後の音と実際のゲインが表示され、上向きは持ち上げ、下向きは抑制です。エンジン更新の案内はライブ表示だけに必要な場合があり、音の処理はすでに動いていることがあります。',
  'help.dynamics.tip':
    '強い持ち上げは背景ノイズも目立たせます。原音の抑揚を残したい場合はミックスを減らします。',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'ディエッサー：鋭い声を和らげる',
  'help.deesser.intro':
    '強いS、T、SHなどの歯擦音が出たときだけ抑えます。4つのグループで検出する音、下げる範囲、速さ、ステレオ内の位置を決めます。',
  'help.deesser.steps':
    'DSP → ディエッサーを開いてオンにし、鋭い声の録音でプリセットを試します。\n検出で気になる音を上下の周波数で挟みます。明るい音すべてに反応しない程度に感度を上げます。\n低減のスペクトルは問題の周波数だけを追い、高域は高域全体を下げます。声全体は音全体を下げるため、単独で録った声向けです。最大低減量と、使える場合は幅も調整します。\nタイミングで音の出始めの捕捉と高域が戻る速さを調整します。範囲の中央は中央の声に集中し、シンバルを残すは明るい打音を保ちます。\nアイソレートで除去される音だけを聴き、オフに戻して全体を判断します。表示は操作中のコントロールに追従します。\nステージのプリセットバーで設定を保存します。組み合わせを残すにはラック全体も保存してください。別のチェーンは複数のステージを置き換える場合があります。',
  'help.deesser.tip':
    '声が不自然になったり音楽の空気感が失われたりする場合は、感度または最大低減量を下げます。再生音の処理であり、マイク用の効果ではありません。',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'ノーマライザーとライブ音量制御',
  'help.normalizer.intro':
    '創作的なステージより前で音源のレベルを調整します。ライブラリのファイルは全体を解析でき、外部音声は再生中に学習します。',
  'help.normalizer.steps':
    'DSP → ノーマライザーを開き、オフ、True Peak、ラウドネスを選びます。外部音声では同じカードがライブレベル制御となり、ピーク保護とライブレベリングを選べます。\nTrue Peakではピーク上限を設定します。音源のピークが上限を超える場合にレベルを下げるモードで、静かな音源を増幅することはありません。\nラウドネスでは目標値とピーク上限を設定します。目標は最も大きい3秒間の区間に適用されます。3秒未満のクリップでは統合ラウドネスを使います。\nライブラリでは音源解析の完了を待ちます。強い区間のラウドネス、統合ラウドネス、適用ゲインを確認してください。統合ラウドネスは曲全体の測定値です。\nライブでは音源を学習している間も再生を続け、ゲイン保持の状態を確認します。さらに大きな区間が来るとゲインが下がる場合があります。静かな区間の相対的なレベルは維持されます。\n目標を上げる前に、適用ゲインと制限の理由を確認します。ピークの余裕や最大増幅量により目標に届かない場合があります。同じ程度の試聴音量で比較してください。強い区間の目標が同じでも、曲全体のラウドネスまで同一になるわけではありません。',
  'help.normalizer.tip':
    '左側の自動ノーマライズはEQの余裕を確保し、Masterは完成後の出力を調整します。これらも録音済みの歪みは修復できません。',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'クロスフェードと独自のフェード曲線',
  'help.crossfade.intro':
    'ライブラリの連続する曲を重ねて切り替えます。DSPフィルターとは別の再生設定で、他のアプリやKaraokeには適用されません。',
  'help.crossfade.steps':
    'ライブラリのキューに2曲以上入れます。DSPの再生オプションからクロスフェードを選んでオンにします。\n長さと、等パワー・滑らか・直線の曲線を選びます。最初の曲が終わりに近づいたときの重なりを聴きます。\nカスタムを選び、出ていく曲と入ってくる曲の点をドラッグします。点にフォーカスを合わせて矢印キーでも調整できます。\n両方の曲線と合計レベルを見ます。両方を高く保つと、重なる部分の音量が大きくなる場合があります。\nカーブを保存で名前を付けて保存し、後で一覧から選べます。形状をリセットは編集する形を初期状態に戻します。',
  'help.crossfade.tip':
    '操作できない場合はライブラリの音声トラックを再生します。この曲線は曲間の切り替えを変え、各曲のEQは変えません。',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'ゲームフィルター：足音、環境音、声',
  'help.gamefilter.intro':
    'ゲームごとに小さな手掛かり、背景、会話を調整できます。そのゲームのプロファイルから始め、聴きながら専用のコピーを調整します。',
  'help.gamefilter.steps':
    'Gaming Labでゲームを選び、まだ読み込まれていなければその音を試します。ゲームのパーツからゲームを選びます。\n小さな足音、リロード、ドアを聴きやすくするには持ち上げ量を上げます。Calmは気を散らす大きな音を抑えます。両方を上げすぎる前に比較します。\n蹄や重い足音の設定は、ブーツ、馬、車両の低い重みを強調します。手掛かりが重くなりすぎる場合はオフにします。\n環境音はゲームの背景を下げたり上げたりします。足音などの明確な音が目立つと作用を緩め、背景と一緒に下げないようにします。\n会話は中央の声を前へ出します。声のための空間を作る設定では、話している間だけ周囲を少し下げます。\n分離再生で変化だけを確認し、全体へ戻します。プロファイルとして保存すれば他のゲームにも使え、リセットは出発点のプロファイルに戻します。',
  'help.gamefilter.tip':
    '独自の3D音声があるゲームではRoomをオフに保つプロファイルで二重の位置処理を避けられます。Roomはヘッドホン向けです。ゲームの音を解除すると音楽の音に戻ります。',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': '曲ごとの音を記憶する',
  'help.songs.intro':
    '曲ごとにプリセット、Tone、EQを出力別に記憶できます。ヘッドホンでの調整はスピーカー用の記憶を変えません。',
  'help.songs.steps':
    '出力のプロファイルの下で曲ごとのサウンドを記憶をオンにします。初期状態はオフです。\n識別できる曲を再生し、プリセット、Tone、EQを変えます。保存予定の通知が出るので、試しただけなら保存しない操作を選びます。\n同じ出力で次に再生すると一時的に呼び戻されます。元に戻す操作は今回だけ適用をやめ、曲を忘れる操作は記憶も削除します。\n曲が終わると出力の元の音に戻ります。別のプロファイルを選ぶと、自分の操作が優先されます。\nSmart EQは測定中に曲へ保存する独自の操作があります。測定した補正を記憶するもので、手動のプリセットやTone、バンドの記憶とは別です。',
  'help.songs.tip':
    '曲の識別にはファイルまたはプレーヤーのメディア情報を使います。曲名がない、または違うと一致しない場合があります。プリアンプは保存されず、読み込まれたゲームの音が優先します。',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'マイカーブ：読み込み、編集、共有',
  'help.mycurves.intro':
    '測定ライブラリの隣にある自分の曲線集です。周波数応答を確認して、補正レイヤーとして使うか、編集可能なEQバンドにするか選べます。',
  'help.mycurves.steps':
    'EQ Presets → マイカーブを開き、検索や並べ替えで保存した曲線を探します。\n曲線の追加では現在のEQ、テキストファイル、測定の選択、貼り付けを使えます。Squiglinkからは書き出したEQテキストを読み込み、保存前にプレビューを確認します。\n曲線として適用するとバンドを残してレイヤーを追加します。EQとして適用すると確認後に選択した両耳・左耳・右耳のバンドを置き換えます。\n曲線のメニューで名前変更、バンド編集、複製、テキストコピー、削除ができます。編集のための再読み込みは不要です。\n一覧の書き出しと読み込みで別のコンピューターへ移せます。測定を共有するときはモデルと測定者を明記します。',
  'help.mycurves.tip':
    '曲線は周波数応答、出力プロファイルはその機器の他の音の設定も含みます。補正前にモデルと出典を確認してください。',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
