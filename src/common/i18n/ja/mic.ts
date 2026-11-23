/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'マイク',
  'mic.label': 'マイク',
  'mic.pickHint': '調整するマイクを選択',
  'mic.list.heading': 'この PC のマイク',
  'mic.list.on': 'オン',
  'mic.list.off': '未設定',
  'mic.live': 'すべてのアプリに適用中',
  'mic.notSetUp': 'このマイクはまだ設定されていません',
  'mic.state.opening': 'マイクを開いています…',
  'mic.state.noInput': '現在、Windows にこのマイクの入力が見つかりません',
  'mic.state.blocked': 'Windows が FluidEQ にこのマイクを開かせませんでした',
  'mic.state.waiting': 'マイクは開いています · エンジンの起動を待っています',
  'mic.meter.gateOpen': '声が通過中',
  'mic.meter.gateClosed': 'ゲート閉',
  'mic.meter.compressor': 'コンプレッサー',
  'mic.meter.limiter': 'リミッター',
  'mic.monitor.label': '最終結果を聴く',
  'mic.monitor.hint': '相手に聞こえる音を、今聴いている出力で再生します',
  'mic.monitor.warning':
    'ヘッドホンを使ってください。スピーカーでは声がマイクに戻り、ハウリングします。',
  'mic.effectsOff.short':
    'このマイクでは Windows のオーディオの拡張機能がオフです',
  'mic.effectsOff.title': '{mic} のオーディオの拡張機能がオフです',
  'mic.effectsOff.body':
    'オフの間、Windows はこのマイクにエフェクトを適用しないため、FluidEQ は処理できません。マイクのプロパティで「オーディオの拡張機能」をオンにしてください。',
  'mic.effectsOff.button': 'Windows のサウンド設定を開く',
  'mic.picture.label':
    'あなたの声：薄い線がマイクの拾った音、明るい線が相手に聞こえる音',
  'mic.picture.raw': 'マイクの音',
  'mic.picture.heard': '相手に聞こえる音',
  'mic.picture.gate': 'ゲート',
  'mic.profile.label': 'マイクプロファイル',
  'mic.profile.pickHint': '使い方に合わせたプロファイルから始めましょう',
  'mic.profile.group.use': '用途別',
  'mic.profile.group.mic': 'マイク別',
  'mic.profile.tuned': '調整済み',
  'mic.profile.stream': '配信',
  'mic.profile.stream.hint': 'Twitch や YouTube 向けの、温かく近くて安定した声',
  'mic.profile.podcast': 'ポッドキャスト',
  'mic.profile.podcast.hint': '穏やかに整えた自然な声',
  'mic.profile.chat': 'ゲームチャット',
  'mic.profile.chat.hint':
    'Discord やチームチャットで前に出るクリアな声。言葉の合間は無音に',
  'mic.profile.sing': '歌',
  'mic.profile.sing.hint':
    '開放的で空気感のある声。ポンピングせず、息づかいもそのまま',
  'mic.profile.broadcast': '放送',
  'mic.profile.broadcast.hint': 'ラジオの声：豊かな低音、締まった密度',
  'mic.profile.noisy': '騒がしい部屋',
  'mic.profile.noisy.hint':
    'ファン、子ども、車の音に：クリーナーとゲートを最大に',
  'mic.profile.meet': '会議',
  'mic.profile.meet.hint':
    'Teams や Zoom 向けの聞き取りやすい声。ノイズ処理は会議アプリに任せます',
  'mic.profile.laptop': 'ノート PC のマイク',
  'mic.profile.laptop.hint':
    '細く遠く響きがちな音に：ローカットは高め、クリーナーは強め',
  'mic.profile.headset': 'ヘッドセットのブームマイク',
  'mic.profile.headset.hint':
    '口元に近い小型カプセル向け：温かみを戻し、ポップノイズを抑えます',
  'mic.reset': '{profile} にリセット',
  'mic.setup.title': '{mic} では FluidEQ Engine がまだ設定されていません。',
  'mic.setup.body':
    'Windows の許可が一度だけ必要です。設定中も出力の再生は止まりません。',
  'mic.setup.button': 'このマイクに設定',
  'mic.setup.working': '設定しています…',
  'mic.setup.declined':
    'Windows の許可が得られなかったため、何も変更していません。',
  'mic.setup.failed': 'このマイクに設定できませんでした。',
  'mic.notFluid.title':
    'マイクごとのサウンドは FluidEQ Engine で再生されます。',
  'mic.notFluid.body':
    'サウンドは保存されており、FluidEQ Engine を選ぶとすぐに適用されます。',
  'mic.empty.title': 'マイクが見つかりません',
  'mic.empty.body':
    'マイクを接続するか、一覧を表示できるよう FluidEQ Engine を更新してください。',
  'mic.stage.lowCut': 'ローカット',
  'mic.stage.cleaner': 'ノイズキャンセリング',
  'mic.stage.gate': 'ゲート',
  'mic.stage.deEsser': 'ディエッサー',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'コンプレッサー',
  'mic.stage.limiter': 'リミッター',
  'mic.lowCut.title': 'ローカット',
  'mic.lowCut.description':
    '声より下のゴロゴロ音、机を叩く音、ファンの音を、クリーナーに届く前に取り除きます。',
  'mic.lowCut.group.below': '声より下',
  'mic.lowCut.group.belowHint':
    '「近接補正」は、カプセルから数センチの距離で声に加わる余分な低音を抑えます。',
  'mic.lowCut.cut': 'カット周波数',
  'mic.lowCut.proximity': '近接補正',
  'mic.lowCut.group.pops': 'ポップノイズ',
  'mic.lowCut.group.popsHint':
    'パ行やバ行の「ボフッ」という音を和らげ、普通の声には手を加えません。',
  'mic.lowCut.plosive': 'ポップ除去',
  'mic.gate.title': 'ゲート',
  'mic.gate.description':
    '言葉の合間にマイクを閉じ、部屋の響きやファン、キーボードの音を入れません。レンジを小さくすると穏やかなエキスパンダーになります。',
  'mic.gate.group.level': '開くタイミング',
  'mic.gate.group.levelHint':
    '図の破線を目安に：声は線を超え、部屋の音は線の下に収まるようにします。',
  'mic.gate.threshold': '開く値',
  'mic.gate.range': '閉じる量',
  'mic.gate.group.time': '速さ',
  'mic.gate.group.timeHint':
    'ホールドは音節の間も開いたままにするので、語尾が切れません。',
  'mic.gate.attack': '開くまで',
  'mic.gate.hold': 'ホールド',
  'mic.gate.release': '閉じるまで',
  'mic.monitor.on': '最終結果を再生中',
  'mic.delay.label': '遅延',
  'mic.delay.measured': 'このマイクでエンジンが測定、カプセルから各アプリまで',
  'mic.delay.unknown': 'エンジンはまだこのマイクを測定していません',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'マイクの処理',
  'mic.rail.note':
    '各スイッチはその段を完全にオフにします。音も遅延も変わりません。段の横の数字はその段が加える遅延です。',
  'mic.meter.noise': '除去したノイズ',
  'mic.cleaner.description':
    '話している間、声の下からキーボード、ファン、部屋の音を取り除きます。',
  'mic.cleaner.strength': '強さ',
  'mic.cleaner.noiseNow': '現在除去しているノイズ',
  'mic.cleaner.noiseHint':
    'クリーニング後に部屋の音が声よりどれだけ下にあるか。薄い線は直近数秒の最大値です。80% を超えると声が加工されたように聞こえ始めます。',
  'mic.cleaner.neverCuts': '途切れません',
  'mic.cleaner.neverCutsHint':
    'モデルが遅れても、声は直前にクリーニングされた瞬間のレベルを保ち、クリックなしでつながります。生の部屋の音になることはありません。そうした瞬間はここで数えます。',
  'mic.cleaner.lateMinute': '直近 1 分間に遅れたブロック',
  'mic.gate.live.title': 'ゲートに対するあなたの声',
  'mic.gate.live.hint':
    'バーは今の声です。線より下ではゲートが声を下げます。少し下で再び閉じるので、線上の声でばたつきません。',
  'mic.gate.live.open': '開 — 声はゲートより {db} dB 上です。',
  'mic.gate.live.closed': '閉 — 声はゲートより {db} dB 下です。',
  'mic.gate.live.opens': '{db} dB で開く',
};
