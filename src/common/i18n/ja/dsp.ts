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

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'FluidEQ 内で再生する音楽にのみ適用されます。Spotify や YouTube など他のアプリは変わりません。',
  'dsp.idle':
    'ライブラリから再生すると起動します。FluidEQ 自身のプレーヤーを処理するため、曲を読み込むまでは何もしません。',
  'dsp.unavailable': '音声処理を開始できませんでした。再生には影響しません。',
  'dsp.presets': 'プリセット',
  'dsp.preset.flat': 'オフ',
  'dsp.preset.lossyRepair': '圧縮音源を補修',
  'dsp.preset.loud': 'ラウド',
  'dsp.bypassed': 'バイパス',
  'dsp.enabled': 'オン',

  'dsp.eqPreset.custom': 'カスタム',
  'dsp.eqPreset.label': 'プリセット',
  'dsp.eqPreset.flat': 'フラット',
  'dsp.eqPreset.vShape': 'V字',
  'dsp.eqPreset.rock': 'ロック',
  'dsp.eqPreset.pop': 'ポップ',
  'dsp.eqPreset.jazz': 'ジャズ',
  'dsp.eqPreset.classical': 'クラシック',
  'dsp.eqPreset.electronic': 'エレクトロニック',
  'dsp.eqPreset.hiphop': 'ヒップホップ',
  'dsp.eqPreset.acoustic': 'アコースティック',
  'dsp.eqPreset.vocal': 'ボーカル',
  'dsp.eqPreset.podcast': 'ポッドキャスト',
  'dsp.eqPreset.bassBoost': '低音ブースト',
  'dsp.eqPreset.trebleBoost': '高音ブースト',
  'dsp.eqPreset.loudness': 'ラウドネス',
  'dsp.eqPreset.lateNight': '深夜',
  'dsp.eqPreset.smallSpeakers': '小型スピーカー',
  'dsp.eqPreset.car': 'カー',
  'dsp.eqPreset.gaming': 'ゲーム',
  'dsp.eqPreset.movie': '映画',
  'dsp.eqPreset.warm': 'ウォーム',
  'dsp.eqPreset.air': 'エア',

  'dsp.eqPreset.import': 'インポート',
  'dsp.eqPreset.export': 'エクスポート',
  'dsp.eqPreset.imported': '{count} 個のフィルターを読み込みました。',
  'dsp.eqPreset.importSkipped':
    '{count} 個のフィルターを読み込み、{skipped} 個をスキップしました。',
  'dsp.eqPreset.importEmpty':
    'このイコライザーが読み取れるフィルターはありませんでした。',
  'dsp.eqPreset.importFailed': 'そのファイルを読み取れませんでした。',
  'dsp.eqPreset.importPreamp': 'プリアンプを {gain} dB に設定しました。',

  'dsp.eq.rack': 'バンド数',
  'dsp.eqModel.label': 'キャラクター',
  'dsp.eqModel.clean': 'クリーン',
  'dsp.eqModel.proportional': 'フォーカス',
  'dsp.eqModel.wide': 'ワイド',
  'dsp.eqImport.title': 'EQ カーブを読み込む',
  'dsp.eqImport.hint':
    'Squiglink、AutoEq、Equalizer APO のカーブを貼り付けるか、そのファイルを選んでください。',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'ファイルを選ぶ',
  'dsp.eqImport.apply': '読み込む',
  'dsp.eqImport.cancel': 'キャンセル',

  'dsp.eq.title': 'イコライザー',
  'dsp.eq.description':
    '15 バンドのパラメトリック EQ。設定値ではなく、フィルターの実際の応答を描いています。',
  'dsp.eq.band': 'バンド',
  'dsp.eq.bands': 'バンド',
  'dsp.eq.shape': 'バンドの種類',
  'dsp.eq.bandOff': 'オフ',
  'dsp.eq.addLeft': 'このバンドの下に追加',
  'dsp.eq.addRight': 'このバンドの上に追加',
  'dsp.eq.type.peak': 'ピーク',
  'dsp.eq.type.lowShelf': 'ローシェルフ',
  'dsp.eq.type.highShelf': 'ハイシェルフ',
  'dsp.eq.type.notch': 'ノッチ',
  'dsp.eq.type.lowPass': 'ローパス',
  'dsp.eq.type.highPass': 'ハイパス',
  'dsp.eq.type.bandPass': 'バンドパス',
  'dsp.eq.frequency': '周波数',
  'dsp.eq.gain': 'ゲイン',
  'dsp.eq.preamp': 'プリアンプ',
  'dsp.eq.quality': '幅',

  'dsp.exciter.title': 'エキサイター',
  'dsp.exciter.description':
    '非可逆エンコーダーが捨てた高域倍音を生成します。復元ではなく、作り出しています。',
  'dsp.exciter.crossover': 'この周波数より上',
  'dsp.exciter.drive': 'ドライブ',
  'dsp.exciter.mix': '量',

  'dsp.compressor.title': 'マルチバンドコンプレッサー',
  'dsp.compressor.description': '3 つの帯域それぞれで音量を均します。',
  'dsp.compressor.band.low': '低域',
  'dsp.compressor.band.mid': '中域',
  'dsp.compressor.band.high': '高域',
  'dsp.compressor.crossoverLow': '低域 / 中域の分割点',
  'dsp.compressor.crossoverHigh': '中域 / 高域の分割点',
  'dsp.compressor.threshold': 'スレッショルド',
  'dsp.compressor.ratio': 'レシオ',
  'dsp.compressor.attack': 'アタック',
  'dsp.compressor.release': 'リリース',
  'dsp.compressor.makeup': 'メイクアップ',

  'dsp.maximizer.title': 'マキシマイザー',
  'dsp.maximizer.description':
    'ピークが上限を超えないようにしながら全体の音量を上げます。',
  'dsp.maximizer.ceiling': '上限',
  'dsp.maximizer.lookAhead': '先読み',
  'dsp.maximizer.release': 'リリース',
  'dsp.maximizer.headroomHint':
    '上限は、この後に出力プロファイルが加える {gain} dB 分の余裕を残しています。',

  'tabs.dsp': 'DSP',
};

export default dsp;
