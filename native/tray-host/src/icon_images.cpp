/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "icon_images.h"

#include <wincodec.h>
#include <wrl/client.h>

namespace feq::tray {
namespace {

using Microsoft::WRL::ComPtr;

/** A top-down 32-bit DIB section of `size` square, its pixels exposed. */
HBITMAP dib_section(int size, void** bits) {
  BITMAPINFO info{};
  info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  info.bmiHeader.biWidth = size;
  info.bmiHeader.biHeight = -size;
  info.bmiHeader.biPlanes = 1;
  info.bmiHeader.biBitCount = 32;
  info.bmiHeader.biCompression = BI_RGB;
  return CreateDIBSection(nullptr, &info, DIB_RGB_COLORS, bits, nullptr, 0);
}

}  // namespace

HICON load_icon(const std::wstring& path, int size) {
  if (path.empty()) {
    return nullptr;
  }
  return static_cast<HICON>(LoadImageW(nullptr, path.c_str(), IMAGE_ICON, size,
                                       size, LR_LOADFROMFILE));
}

HBITMAP load_menu_bitmap(const std::wstring& path, int size) {
  const HICON icon = load_icon(path, size);
  if (icon == nullptr) {
    return nullptr;
  }
  // WIC reads the icon's colour and alpha as they are (straight BGRA, or the
  // mask for an icon with no alpha), and converts to premultiplied: a menu
  // draws a bitmap's alpha premultiplied, and read straight every soft edge
  // would carry a light fringe — `nativeBitmap` in `tray.ts` does the same.
  ComPtr<IWICImagingFactory> factory;
  ComPtr<IWICBitmap> drawing;
  ComPtr<IWICFormatConverter> converter;
  const bool read =
      SUCCEEDED(CoCreateInstance(CLSID_WICImagingFactory, nullptr,
                                 CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory))) &&
      SUCCEEDED(factory->CreateBitmapFromHICON(icon, &drawing)) &&
      SUCCEEDED(factory->CreateFormatConverter(&converter)) &&
      SUCCEEDED(converter->Initialize(drawing.Get(), GUID_WICPixelFormat32bppPBGRA,
                                      WICBitmapDitherTypeNone, nullptr, 0.0,
                                      WICBitmapPaletteTypeCustom));
  DestroyIcon(icon);
  UINT width = 0;
  UINT height = 0;
  if (!read || FAILED(converter->GetSize(&width, &height)) ||
      width != static_cast<UINT>(size) || height != static_cast<UINT>(size)) {
    return nullptr;
  }
  void* bits = nullptr;
  const HBITMAP bitmap = dib_section(size, &bits);
  if (bitmap == nullptr) {
    return nullptr;
  }
  const UINT stride = width * 4;
  if (FAILED(converter->CopyPixels(nullptr, stride, stride * height,
                                   static_cast<BYTE*>(bits)))) {
    DeleteObject(bitmap);
    return nullptr;
  }
  return bitmap;
}

}  // namespace feq::tray
