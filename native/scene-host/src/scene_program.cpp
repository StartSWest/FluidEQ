/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "scene_program.h"

#include <algorithm>

namespace feq::scene {
namespace {

using namespace gl;

/** A shader with its source, compiling; nothing about it asked yet. */
GLuint shader_of(const Api& gl, GLenum kind, const std::string& source) {
  const GLuint shader = gl.CreateShader(kind);
  const GLchar* text = source.c_str();
  const auto length = static_cast<GLint>(source.size());
  gl.ShaderSource(shader, 1, &text, &length);
  gl.CompileShader(shader);
  return shader;
}

/** A shader's or program's own words, without the terminating NUL. */
std::string info_log(const Api& gl, GLuint object, bool shader) {
  GLint size = 0;
  if (shader) {
    gl.GetShaderiv(object, kInfoLogLength, &size);
  } else {
    gl.GetProgramiv(object, kInfoLogLength, &size);
  }
  if (size <= 1) {
    return {};
  }
  std::string log(static_cast<std::size_t>(size), '\0');
  if (shader) {
    gl.GetShaderInfoLog(object, size, nullptr, log.data());
  } else {
    gl.GetProgramInfoLog(object, size, nullptr, log.data());
  }
  log.resize(static_cast<std::size_t>(size - 1));
  return log;
}

/** An R8 row of `width` texels, filtered, clamped: `createDataTexture`. */
GLuint data_texture(const Api& gl, std::size_t width) {
  GLuint texture = 0;
  gl.GenTextures(1, &texture);
  gl.BindTexture(kTexture2D, texture);
  gl.PixelStorei(kUnpackAlignment, 1);
  gl.TexImage2D(kTexture2D, 0, static_cast<GLint>(kR8),
                static_cast<GLsizei>(width), 1, 0, kRed, kUnsignedByte,
                nullptr);
  gl.TexParameteri(kTexture2D, kTextureMinFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
  gl.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
  gl.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
  return texture;
}

void upload(const Api& gl, GLenum unit, GLuint texture, const std::uint8_t* row,
            std::size_t width) {
  gl.ActiveTexture(unit);
  gl.BindTexture(kTexture2D, texture);
  gl.TexSubImage2D(kTexture2D, 0, 0, 0, static_cast<GLsizei>(width), 1, kRed,
                   kUnsignedByte, row);
}

auto f(double value) { return static_cast<GLfloat>(value); }

}  // namespace

std::unique_ptr<SceneLink> SceneProgram::start(const gl::Api& api,
                                               ScenePack pack) {
  auto link = std::unique_ptr<SceneLink>(new SceneLink(api, std::move(pack)));
  const ScenePack& made = link->pack_;
  link->vertex_ = shader_of(api, kVertexShader, made.vertex_source);
  link->fragment_ = shader_of(api, kFragmentShader, made.fragment_source);
  link->program_ = api.CreateProgram();
  api.AttachShader(link->program_, link->vertex_);
  api.AttachShader(link->program_, link->fragment_);
  api.LinkProgram(link->program_);
  return link;
}

std::unique_ptr<SceneProgram> SceneProgram::compile(const gl::Api& api,
                                                    const ScenePack& pack,
                                                    std::string& log) {
  return start(api, pack)->finish(log);
}

bool SceneLink::done() const {
  if (gl_.MaxShaderCompilerThreads == nullptr) {
    return true;
  }
  GLint finished = 0;
  gl_.GetProgramiv(program_, kCompletionStatus, &finished);
  return finished != 0;
}

SceneLink::~SceneLink() {
  // Flagged only while attached: each shader goes with its program.
  gl_.DeleteShader(vertex_);
  gl_.DeleteShader(fragment_);
  gl_.DeleteProgram(program_);
}

std::unique_ptr<SceneProgram> SceneLink::finish(std::string& log) {
  const Api& api = gl_;
  const ScenePack& pack = pack_;
  GLint linked = 0;
  api.GetProgramiv(program_, kLinkStatus, &linked);
  if (linked == 0) {
    log = info_log(api, fragment_, true);
    if (log.empty()) {
      log = info_log(api, vertex_, true);
    }
    if (log.empty()) {
      log = info_log(api, program_, false);
    }
    if (log.empty()) {
      log = "unknown link error";
    }
    return nullptr;
  }
  if (pack.artwork_width > 0 &&
      pack.artwork.size() != static_cast<std::size_t>(pack.artwork_width) *
                                 static_cast<std::size_t>(pack.artwork_height) *
                                 4) {
    log = "scene artwork was not decoded";
    return nullptr;
  }
  auto program = std::unique_ptr<SceneProgram>(new SceneProgram(api));
  program->program_ = program_;
  program_ = 0;
  program->view_ = pack.view;
  program->spectrum_rect_ = pack.spectrum_rect;
  const auto at = [&](const char* name) {
    return api.GetUniformLocation(program->program_, name);
  };
  program->at_ = {at("uTime"),        at("uResolution"),   at("uLevel"),
                  at("uBeat"),        at("uMusicAccent"),  at("uMusicRun"),
                  at("uBands"),       at("uAccent"),       at("uSceneFade"),
                  at("uSpectrum"),    at("uSpectrumSlow"), at("uSpectrumRect"),
                  at("uWaveform"),    at("uArtwork"),      at("uRhythm"),
                  at("uDrums"),       at("uSong"),         at("uStereo"),
                  at("uVoice"),       at("uPointer"),      at("uTap"),
                  at("uCamera"),      at("uView")};
  for (const auto& [name, fallback] : pack.params) {
    program->params_.push_back(at(name.c_str()));
    program->fallbacks_.push_back(fallback);
  }
  program->spectrum_ = data_texture(api, kSpectrumTexels);
  program->waveform_ = data_texture(api, kWaveformTexels);
  if (program->at_.spectrum_slow >= 0) {
    program->spectrum_slow_ = data_texture(api, kSpectrumTexels);
  }
  if (pack.artwork_width > 0) {
    api.GenTextures(1, &program->artwork_);
    api.BindTexture(kTexture2D, program->artwork_);
    api.PixelStorei(kUnpackAlignment, 4);
    api.TexImage2D(kTexture2D, 0, static_cast<GLint>(kRgba), pack.artwork_width,
                   pack.artwork_height, 0, kRgba, kUnsignedByte,
                   pack.artwork.data());
    api.TexParameteri(kTexture2D, kTextureMinFilter, kLinearMipmapLinear);
    api.TexParameteri(kTexture2D, kTextureMagFilter, kLinear);
    api.TexParameteri(kTexture2D, kTextureWrapS, kClampToEdge);
    api.TexParameteri(kTexture2D, kTextureWrapT, kClampToEdge);
    api.GenerateMipmap(kTexture2D);
  }
  api.GenVertexArrays(1, &program->vao_);
  return program;
}

void SceneProgram::draw(const SceneFrame& frame, int width, int height) {
  const Api& gl = gl_;
  gl.Viewport(0, 0, width, height);
  gl.UseProgram(program_);
  gl.BindVertexArray(vao_);
  gl.Uniform2f(at_.music_accent, f(frame.music_accent[0]),
               f(frame.music_accent[1]));
  gl.Uniform2f(at_.music_run, f(frame.music_run[0]), f(frame.music_run[1]));
  upload(gl, kTexture0, spectrum_, frame.spectrum.data(), kSpectrumTexels);
  gl.Uniform1i(at_.spectrum, 0);
  if (spectrum_slow_ != 0) {
    upload(gl, kTexture0 + 3, spectrum_slow_, frame.spectrum_slow.data(),
           kSpectrumTexels);
    gl.Uniform1i(at_.spectrum_slow, 3);
  }
  upload(gl, kTexture0 + 1, waveform_, frame.waveform.data(), kWaveformTexels);
  gl.Uniform1i(at_.waveform, 1);
  if (artwork_ != 0) {
    gl.ActiveTexture(kTexture0 + 2);
    gl.BindTexture(kTexture2D, artwork_);
    gl.Uniform1i(at_.artwork, 2);
  }
  gl.Uniform1f(at_.time, f(frame.time_seconds));
  // The lamps' panel is the whole surface (`FULL_VIEW`), framed as the
  // scene asks.
  gl.Uniform2f(at_.resolution, static_cast<GLfloat>(width),
               static_cast<GLfloat>(height));
  gl.Uniform4f(at_.view, view_[0], view_[1], view_[2], view_[3]);
  gl.Uniform4f(at_.spectrum_rect, spectrum_rect_[0], spectrum_rect_[1],
               spectrum_rect_[2], spectrum_rect_[3]);
  gl.Uniform1f(at_.level, f(frame.level));
  gl.Uniform1f(at_.beat, f(frame.beat));
  gl.Uniform3f(at_.bands, f(frame.bands[0]), f(frame.bands[1]),
               f(frame.bands[2]));
  gl.Uniform3f(at_.accent, f(frame.accent[0]), f(frame.accent[1]),
               f(frame.accent[2]));
  gl.Uniform1f(at_.fade, f(frame.fade));
  gl.Uniform4f(at_.rhythm, f(frame.rhythm[0]), f(frame.rhythm[1]),
               f(frame.rhythm[2]), f(frame.rhythm[3]));
  gl.Uniform3f(at_.drums, f(frame.drums[0]), f(frame.drums[1]),
               f(frame.drums[2]));
  gl.Uniform4f(at_.song, f(frame.song[0]), f(frame.song[1]), f(frame.song[2]),
               f(frame.song[3]));
  gl.Uniform2f(at_.stereo, f(frame.stereo[0]), f(frame.stereo[1]));
  gl.Uniform3f(at_.voice, f(frame.voice[0]), f(frame.voice[1]),
               f(frame.voice[2]));
  // Nobody points at a lamp: `NO_POINTER`, `NO_TAP`, `HOME_CAMERA`.
  gl.Uniform4f(at_.pointer, 0.5F, 0.5F, 0.0F, 0.0F);
  gl.Uniform4f(at_.tap, 0.5F, 0.5F, 60.0F, 0.0F);
  gl.Uniform3f(at_.camera, 0.0F, 0.0F, 1.0F);
  for (std::size_t at = 0; at < params_.size(); ++at) {
    gl.Uniform1f(params_[at], f(at < frame.params.size() ? frame.params[at]
                                                     : fallbacks_[at]));
  }
  gl.DrawArrays(kTriangles, 0, 3);
}

SceneProgram::~SceneProgram() {
  const Api& gl = gl_;
  gl.DeleteVertexArrays(1, &vao_);
  const std::array<GLuint, 4> textures{spectrum_, spectrum_slow_, waveform_,
                                       artwork_};
  gl.DeleteTextures(static_cast<GLsizei>(textures.size()), textures.data());
  gl.DeleteProgram(program_);
}

}  // namespace feq::scene
