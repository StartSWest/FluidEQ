/* FluidEQ — GPL-3.0-or-later */

import type { BrowserWindow } from 'electron';

type TId = bigint | null;
interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * AppKit can reset the titlebar's NSView frame without changing Electron's
 * stored button position or its computed overlay rectangle. Those two APIs
 * therefore cannot detect the jump. Observe the actual native views instead.
 * Only public AppKit notifications/selectors, on this window's main thread;
 * no accessibility permission, method replacement, timer, or other app access.
 */
const makeRuntime = () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- loaded only for a Mac window
  const koffi = require('koffi') as typeof import('koffi');
  const objc = koffi.load('/usr/lib/libobjc.A.dylib');
  koffi.load('/System/Library/Frameworks/AppKit.framework/AppKit');
  const selector = objc.func('void *sel_registerName(const char *name)') as (
    name: string,
  ) => TId;
  const classOf = objc.func('void *objc_getClass(const char *name)') as (
    name: string,
  ) => TId;
  const send = objc.func('objc_msgSend', 'void *', ['void *', 'void *']) as (
    object: TId,
    method: TId,
  ) => TId;
  const sendIndex = objc.func('objc_msgSend', 'void *', [
    'void *',
    'void *',
    'uint64_t',
  ]) as (object: TId, method: TId, index: number) => TId;
  const sendString = objc.func('objc_msgSend', 'void *', [
    'void *',
    'void *',
    'str',
  ]) as (object: TId, method: TId, value: string) => TId;
  const sendBool = objc.func('objc_msgSend', 'void', [
    'void *',
    'void *',
    'bool',
  ]) as (object: TId, method: TId, value: boolean) => void;
  const readBool = objc.func('objc_msgSend', 'bool', ['void *', 'void *']) as (
    object: TId,
    method: TId,
  ) => boolean;
  // NSRect is four CGFloat doubles on the supported arm64 ABI.
  const rect = koffi.struct({
    x: 'double',
    y: 'double',
    width: 'double',
    height: 'double',
  });
  const frame = objc.func('objc_msgSend', rect, ['void *', 'void *']) as (
    object: TId,
    method: TId,
  ) => IRect;
  const convert = objc.func('objc_msgSend', rect, [
    'void *',
    'void *',
    rect,
    'void *',
  ]) as (object: TId, method: TId, value: IRect, view: TId) => IRect;
  const observe = objc.func('objc_msgSend', 'void', [
    'void *',
    'void *',
    'void *',
    'void *',
    'void *',
    'void *',
  ]) as (
    center: TId,
    method: TId,
    observer: TId,
    action: TId,
    name: TId,
    object: TId,
  ) => void;
  const remove = objc.func('objc_msgSend', 'void', [
    'void *',
    'void *',
    'void *',
  ]) as (center: TId, method: TId, observer: TId) => void;
  const center = send(
    classOf('NSNotificationCenter'),
    selector('defaultCenter'),
  );
  const callbacks = new Map<TId, () => void>();
  const action = selector('fluidEQTitlebarFrameChanged:');
  const allocateClass = objc.func(
    'void *objc_allocateClassPair(void *parent, const char *name, size_t extra)',
  ) as (parent: TId, name: string, extra: number) => TId;
  const addMethod = objc.func(
    'bool class_addMethod(void *cls, void *name, void *implementation, const char *types)',
  ) as (cls: TId, name: TId, implementation: bigint, types: string) => boolean;
  const registerClass = objc.func('void objc_registerClassPair(void *cls)') as (
    cls: TId,
  ) => void;
  const observerClass = allocateClass(
    classOf('NSObject'),
    'FluidEQTitlebarFrameObserver',
    0,
  );
  // One registered method for the process. Per-window observers are removed
  // and released below; the method stays callable for the class's lifetime.
  const method = koffi.register(
    (observer: TId) => callbacks.get(observer)?.(),
    koffi.pointer(koffi.proto('void', ['void *', 'void *', 'void *'])),
  );
  if (!observerClass || !addMethod(observerClass, action, method, 'v@:@')) {
    throw new Error('Could not register the Mac titlebar frame observer.');
  }
  registerClass(observerClass);
  const string = (value: string) =>
    sendString(classOf('NSString'), selector('stringWithUTF8String:'), value);

  return (window: BrowserWindow, changed: () => void) => {
    const view = window.getNativeWindowHandle().readBigUInt64LE();
    const nativeWindow = send(view, selector('window'));
    if (!nativeWindow) {
      throw new Error('No native Mac window is available for its titlebar.');
    }
    const observer = send(
      send(observerClass, selector('alloc')),
      selector('init'),
    );
    let watched = new Map<TId, boolean>();
    let watchingWindow = false;
    const button = () =>
      sendIndex(nativeWindow, selector('standardWindowButton:'), 0);
    const unwatch = () => {
      remove(center, selector('removeObserver:'), observer);
      watched.forEach((wasPosting, object) => {
        sendBool(
          object,
          selector('setPostsFrameChangedNotifications:'),
          wasPosting,
        );
        send(object, selector('release'));
      });
      watched = new Map();
      watchingWindow = false;
    };
    const watch = () => {
      const close = button();
      const row = send(close, selector('superview'));
      const container = send(row, selector('superview'));
      const views = [
        close,
        row,
        container,
        sendIndex(nativeWindow, selector('standardWindowButton:'), 1),
        sendIndex(nativeWindow, selector('standardWindowButton:'), 2),
      ].filter((item): item is bigint => item !== null);
      if (
        watchingWindow &&
        views.length === watched.size &&
        views.every((item) => watched.has(item))
      ) {
        return;
      }
      unwatch();
      new Set(views).forEach((object) => {
        send(object, selector('retain'));
        watched.set(
          object,
          readBool(object, selector('postsFrameChangedNotifications')),
        );
        sendBool(object, selector('setPostsFrameChangedNotifications:'), true);
        observe(
          center,
          selector('addObserver:selector:name:object:'),
          observer,
          action,
          string('NSViewFrameDidChangeNotification'),
          object,
        );
      });
      // Buttons can be removed/recreated by AppKit. Rebind at its actual
      // window update, rather than retaining stale views until the next IPC.
      observe(
        center,
        selector('addObserver:selector:name:object:'),
        observer,
        action,
        string('NSWindowDidUpdateNotification'),
        nativeWindow,
      );
      watchingWindow = true;
    };
    callbacks.set(observer, () => {
      watch();
      changed();
    });
    watch();
    return {
      read: () => {
        const close = button();
        if (!close) {
          return undefined;
        }
        const boundsOf = (object: TId) =>
          convert(
            object,
            selector('convertRect:toView:'),
            frame(object, selector('bounds')),
            null,
          );
        const bounds = boundsOf(close);
        // Electron mirrors the three controls on an RTL system. Its margin
        // describes their left edge, which need not be the close button.
        const left = Math.min(
          bounds.x,
          ...[1, 2].map((index) => {
            const other = sendIndex(
              nativeWindow,
              selector('standardWindowButton:'),
              index,
            );
            return other ? boundsOf(other).x : bounds.x;
          }),
        );
        const windowFrame = frame(nativeWindow, selector('frame'));
        return {
          x: left,
          y: windowFrame.height - bounds.y - bounds.height,
          height: bounds.height,
          hidden: readBool(close, selector('isHiddenOrHasHiddenAncestor')),
        };
      },
      stop: () => {
        callbacks.delete(observer);
        unwatch();
        send(observer, selector('release'));
      },
    };
  };
};

let runtime: ReturnType<typeof makeRuntime> | undefined;

export default function watchMacTitlebar(
  window: BrowserWindow,
  changed: () => void,
) {
  runtime ??= makeRuntime();
  return runtime(window, changed);
}
