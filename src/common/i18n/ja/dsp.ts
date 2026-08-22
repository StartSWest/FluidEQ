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
  'dsp.enabled': 'オン',

  'dsp.eq.title': 'イコライザー',
  'dsp.eq.description':
    '6 バンドのパラメトリック EQ。設定値ではなく、フィルターの実際の応答を描いています。',
  'dsp.eq.shape': 'バンドの種類',
  'dsp.eq.bandOff': 'オフ',
  'dsp.eq.frequency': '周波数',
  'dsp.eq.gain': 'ゲイン',
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
