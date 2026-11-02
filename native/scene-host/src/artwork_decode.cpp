/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "artwork_decode.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wincodec.h>
#include <wrl/client.h>

#include <cstring>

namespace feq::scene {

using Microsoft::WRL::ComPtr;

bool decode_artwork(std::span<const std::uint8_t> webp, int width, int height,
                    std::vector<std::uint8_t>& rgba, std::string& why) {
  if (width <= 0 || height <= 0 || webp.empty() ||
      webp.size() > static_cast<std::size_t>(MAXDWORD)) {
    why = "the artwork is empty";
    return false;
  }
  ComPtr<IWICImagingFactory> factory;
  if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr,
                              CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory)))) {
    why = "Windows' image decoders could not be opened";
    return false;
  }
  ComPtr<IWICStream> stream;
  ComPtr<IWICBitmapDecoder> decoder;
  // WIC reads the bytes where they lie and never writes them.
  if (FAILED(factory->CreateStream(&stream)) ||
      FAILED(stream->InitializeFromMemory(
          const_cast<BYTE*>(webp.data()), static_cast<DWORD>(webp.size()))) ||
      FAILED(factory->CreateDecoderFromStream(
          stream.Get(), nullptr, WICDecodeMetadataCacheOnDemand, &decoder))) {
    why = "the artwork could not be decoded (no WebP codec?)";
    return false;
  }
  GUID container{};
  if (FAILED(decoder->GetContainerFormat(&container)) ||
      !IsEqualGUID(container, GUID_ContainerFormatWebp)) {
    why = "the artwork is not a WebP";
    return false;
  }
  ComPtr<IWICBitmapFrameDecode> frame;
  UINT decoded_width = 0;
  UINT decoded_height = 0;
  if (FAILED(decoder->GetFrame(0, &frame)) ||
      FAILED(frame->GetSize(&decoded_width, &decoded_height))) {
    why = "the artwork's picture could not be read";
    return false;
  }
  if (decoded_width != static_cast<UINT>(width) ||
      decoded_height != static_cast<UINT>(height)) {
    why = "the artwork's size differs from its signed header";
    return false;
  }
  ComPtr<IWICFormatConverter> converter;
  if (FAILED(factory->CreateFormatConverter(&converter)) ||
      FAILED(converter->Initialize(frame.Get(), GUID_WICPixelFormat32bppPRGBA,
                                   WICBitmapDitherTypeNone, nullptr, 0.0,
                                   WICBitmapPaletteTypeCustom))) {
    why = "the artwork could not be premultiplied";
    return false;
  }
  const std::size_t stride = static_cast<std::size_t>(width) * 4;
  std::vector<std::uint8_t> top_down(stride * static_cast<std::size_t>(height));
  if (FAILED(converter->CopyPixels(nullptr, static_cast<UINT>(stride),
                                   static_cast<UINT>(top_down.size()),
                                   top_down.data()))) {
    why = "the artwork's pixels could not be copied";
    return false;
  }
  rgba.resize(top_down.size());
  for (int row = 0; row < height; ++row) {
    std::memcpy(rgba.data() + static_cast<std::size_t>(row) * stride,
                top_down.data() +
                    static_cast<std::size_t>(height - 1 - row) * stride,
                stride);
  }
  return true;
}

}  // namespace feq::scene
