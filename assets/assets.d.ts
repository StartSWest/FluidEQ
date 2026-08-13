type Styles = Record<string, string>;

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: Styles;
  export default content;
}

declare module '*.sass' {
  const content: Styles;
  export default content;
}

declare module '*.css' {
  const content: Styles;
  export default content;
}

declare module '*.worklet' {
  const url: string;
  export default url;
}

declare module '*.json?url' {
  const url: string;
  export default url;
}

declare module '*.bin?url' {
  const url: string;
  export default url;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module '@fluideq/whisper-wasm' {
  const url: string;
  export default url;
}
