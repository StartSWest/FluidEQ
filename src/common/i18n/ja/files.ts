const files = {
  'files.title.sharePreset': 'EQ プリセットを共有',
  'files.title.exportDspChain': 'DSP チェーンのプリセットを書き出す',
  'files.title.importEq': 'EQ 設定を読み込む',
  'files.title.importImpulse': 'インパルス応答を読み込む',
  'files.title.exportChain': 'このチェーンを書き出す',
  'files.title.importChain': 'チェーンを読み込む',
  'files.title.exportKaraoke': 'カラオケを書き出す',
  'files.title.saveDownload': 'ダウンロードをパソコンに保存',
  'files.save': '保存',
  'files.type.eqPreset': 'FluidEQ の EQ プリセット',
  'files.type.dspChain': 'FluidEQ の DSP チェーン',
  'files.type.eqSettings': 'EQ 設定',
  'files.type.impulse': 'WAV インパルス応答',
  'files.type.chain': 'FluidEQ のチェーン',
  'files.type.scene': 'FluidEQ のシーン',
  'files.type.programs': 'プログラム',
  'files.type.pictures': '画像',
  'files.type.all': 'すべてのファイル',
  'files.imported.profile':
    'FluidEQ のプロファイルから {count} 個のバンドを読み込みました。',
  'files.imported.graphicEq':
    'GraphicEQ ファイルから {count} 個のバンドを読み込みました。',
  'files.imported.parametricEq':
    'Equalizer APO の ParametricEQ ファイルから {count} 個のバンドを読み込みました。',
  'files.imported.skipped':
    '{count} 個のバンドは FluidEQ で編集できないフィルターの種類だったため、スキップしました。',
  'files.imported.squiglink':
    'Squiglink の書き出しから {count} 個のバンドを読み込みました。',
  'files.imported.squiglinkSkipped':
    '{count} 個のバンドは FluidEQ で編集できなかったため、スキップしました。',
  'files.imported.preampKept':
    'ファイルのプリアンプ {gain} dB をそのまま使うため、自動ノーマライズはオフになっています。',
  'files.impulse.applied': '{name} を適用しました。',
  'files.chain.exported': '{device} のチェーンを書き出しました。',
  'files.chain.imported': 'チェーンを読み込みました。',
  'files.chain.importedFrom': '{device} のチェーンを読み込みました。',
  'files.chain.noOutput': '有効な出力がないため、読み込む先がありません。',
  'files.chain.notChain': 'そのファイルは FluidEQ のチェーンではありません。',
  'files.squiglink.empty':
    '読み込む前に、Squiglink の EQ の書き出しを貼り付けてください。',
  'files.squiglink.tooLarge': 'その EQ の書き出しは大きすぎて読み込めません。',
  'files.squiglink.noFilters':
    'Equalizer APO のフィルターが見つかりませんでした。Squiglink から書き出した ParametricEQ または GraphicEQ のテキストをコピーしてください。',
  'files.eq.tooLarge': 'そのファイルは EQ 設定としては大きすぎます。',
  'files.eq.notProfile':
    'その JSON ファイルは FluidEQ のプロファイルではありません。',
  'files.eq.noFilters':
    'そのファイルに Equalizer APO のフィルターが見つかりませんでした。ParametricEQ、GraphicEQ、または FluidEQ のプロファイルが必要です。',
  'files.wav.notWav': 'そのファイルは WAV のインパルス応答ではありません。',
  'files.wav.truncated': 'その WAV ファイルは途中で切れています。',
  'files.wav.unsupported': 'その WAV 形式は Equalizer APO では使えません。',
  'files.wav.noFormat': 'その WAV ファイルにはフォーマット情報がありません。',
  'files.wav.tooLarge':
    'そのインパルス応答は大きすぎて、安全に読み込めません。',
  'files.wav.rate':
    'そのインパルス応答は {rate} Hz です。Equalizer APO では {rates} Hz のいずれかが必要です。',
  'files.wav.noChunks':
    'その WAV ファイルには、使えるフォーマット情報またはデータがありません。',
  'files.wav.sampleFormat': 'その WAV のサンプル形式は安全に解析できません。',
  'files.wav.noSamples': 'その WAV のインパルス応答にはサンプルがありません。',
  'files.wav.badSamples':
    'その WAV のインパルス応答には無効なサンプルが含まれています。',
  'files.wav.silent':
    'その WAV のインパルス応答には測定できる応答がありません。',
  'files.apo.notLocated':
    'Equalizer APO がインストールされていないか、インストール先が見つかりません。',
  'files.apo.selectorMissing':
    'Equalizer APO のデバイス設定ツールが見つかりません。',
  'files.apo.editorMissing': 'Equalizer APO の設定が見つかりません。',
  'files.wav.tooLong':
    'そのインパルス応答は長すぎて、安全にノーマライズするための解析ができません。',
} as const;

export default files;
