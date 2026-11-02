/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The OpenGL ES 3.0 the scenes are written in, from the ANGLE Electron ships
// beside itself (libEGL.dll, libGLESv2.dll — the same layer Chromium draws
// every scene through on Windows, over Direct3D 11), loaded by path so the
// scene host links against nothing it does not ship and compiles a scene
// exactly as the window's WebGL2 does. Only the calls the scene contract,
// the flash guard and the lamps' read back need; the constants are the
// Khronos values.

#include <cstdint>
#include <memory>
#include <string>

namespace feq::scene::gl {

using GLenum = unsigned int;
using GLuint = unsigned int;
using GLint = int;
using GLsizei = int;
using GLfloat = float;
using GLboolean = unsigned char;
using GLbitfield = unsigned int;
using GLchar = char;

inline constexpr GLenum kFragmentShader = 0x8B30;
inline constexpr GLenum kVertexShader = 0x8B31;
inline constexpr GLenum kCompileStatus = 0x8B81;
inline constexpr GLenum kLinkStatus = 0x8B82;
inline constexpr GLenum kInfoLogLength = 0x8B84;
inline constexpr GLenum kTexture2D = 0x0DE1;
inline constexpr GLenum kTexture0 = 0x84C0;
inline constexpr GLenum kR8 = 0x8229;
inline constexpr GLenum kRed = 0x1903;
inline constexpr GLenum kRgba = 0x1908;
inline constexpr GLenum kRgba8 = 0x8058;
inline constexpr GLenum kUnsignedByte = 0x1401;
inline constexpr GLenum kTextureMinFilter = 0x2801;
inline constexpr GLenum kTextureMagFilter = 0x2800;
inline constexpr GLenum kTextureWrapS = 0x2802;
inline constexpr GLenum kTextureWrapT = 0x2803;
inline constexpr GLint kLinear = 0x2601;
inline constexpr GLint kLinearMipmapLinear = 0x2703;
inline constexpr GLint kClampToEdge = 0x812F;
inline constexpr GLenum kUnpackAlignment = 0x0CF5;
inline constexpr GLenum kTriangles = 0x0004;
inline constexpr GLenum kColorBufferBit = 0x00004000;
inline constexpr GLenum kFramebuffer = 0x8D40;
inline constexpr GLenum kColorAttachment0 = 0x8CE0;
inline constexpr GLenum kFramebufferComplete = 0x8CD5;
inline constexpr GLenum kReadFramebuffer = 0x8CA8;
inline constexpr GLenum kDrawFramebuffer = 0x8CA9;
inline constexpr GLenum kRgba16f = 0x881A;
inline constexpr GLenum kHalfFloat = 0x140B;
inline constexpr GLenum kExtensions = 0x1F03;
/** `KHR_parallel_shader_compile`: whether a compile or link has finished. */
inline constexpr GLenum kCompletionStatus = 0x91B1;
/** `glGetError` once Direct3D has reset the device under the context. */
inline constexpr GLenum kContextLost = 0x0507;

struct Api {
  GLuint (*CreateShader)(GLenum);
  void (*ShaderSource)(GLuint, GLsizei, const GLchar* const*, const GLint*);
  void (*CompileShader)(GLuint);
  void (*GetShaderiv)(GLuint, GLenum, GLint*);
  void (*GetShaderInfoLog)(GLuint, GLsizei, GLsizei*, GLchar*);
  GLuint (*CreateProgram)();
  void (*AttachShader)(GLuint, GLuint);
  void (*LinkProgram)(GLuint);
  void (*GetProgramiv)(GLuint, GLenum, GLint*);
  void (*GetProgramInfoLog)(GLuint, GLsizei, GLsizei*, GLchar*);
  void (*DeleteShader)(GLuint);
  void (*DeleteProgram)(GLuint);
  void (*UseProgram)(GLuint);
  GLint (*GetUniformLocation)(GLuint, const GLchar*);
  void (*Uniform1f)(GLint, GLfloat);
  void (*Uniform2f)(GLint, GLfloat, GLfloat);
  void (*Uniform3f)(GLint, GLfloat, GLfloat, GLfloat);
  void (*Uniform4f)(GLint, GLfloat, GLfloat, GLfloat, GLfloat);
  void (*Uniform1i)(GLint, GLint);
  void (*GenTextures)(GLsizei, GLuint*);
  void (*DeleteTextures)(GLsizei, const GLuint*);
  void (*BindTexture)(GLenum, GLuint);
  void (*TexImage2D)(GLenum, GLint, GLint, GLsizei, GLsizei, GLint, GLenum,
                     GLenum, const void*);
  void (*TexSubImage2D)(GLenum, GLint, GLint, GLint, GLsizei, GLsizei, GLenum,
                        GLenum, const void*);
  void (*TexParameteri)(GLenum, GLenum, GLint);
  void (*PixelStorei)(GLenum, GLint);
  void (*ActiveTexture)(GLenum);
  void (*GenerateMipmap)(GLenum);
  void (*GenVertexArrays)(GLsizei, GLuint*);
  void (*BindVertexArray)(GLuint);
  void (*DeleteVertexArrays)(GLsizei, const GLuint*);
  void (*Viewport)(GLint, GLint, GLsizei, GLsizei);
  void (*DrawArrays)(GLenum, GLint, GLsizei);
  void (*ReadPixels)(GLint, GLint, GLsizei, GLsizei, GLenum, GLenum, void*);
  void (*ClearColor)(GLfloat, GLfloat, GLfloat, GLfloat);
  void (*Clear)(GLbitfield);
  GLenum (*GetError)();
  void (*Finish)();
  void (*GenFramebuffers)(GLsizei, GLuint*);
  void (*BindFramebuffer)(GLenum, GLuint);
  void (*FramebufferTexture2D)(GLenum, GLenum, GLenum, GLuint, GLint);
  GLenum (*CheckFramebufferStatus)(GLenum);
  void (*DeleteFramebuffers)(GLsizei, const GLuint*);
  void (*BlitFramebuffer)(GLint, GLint, GLint, GLint, GLint, GLint, GLint,
                          GLint, GLbitfield, GLenum);
  const unsigned char* (*GetString)(GLenum);
  /**
   * `KHR_parallel_shader_compile`, null where ANGLE does not offer it: a
   * scene then links in one blocking call, as before.
   */
  void (*MaxShaderCompilerThreads)(GLuint) = nullptr;
};

/**
 * A context of OpenGL ES 3.0 on ANGLE's Direct3D 11, drawing off screen into
 * a surface of `width` by `height` — or, after `draw_into`, into a window —
 * current on the calling thread. Built from the two libraries in
 * `angle_dir`; `why` says what failed when it is not.
 */
class Context {
 public:
  static Context* create(const std::wstring& angle_dir, int width, int height,
                         std::string& why);
  ~Context();
  const Api& gl() const { return api_; }
  bool resize(int width, int height);
  /**
   * Draws into `window` (an HWND) from now on instead of off screen, its
   * frames presented once per refresh of the monitor it is on.
   */
  bool draw_into(void* window);
  /** Shows what was drawn into the window; waits for the monitor's refresh. */
  bool present();

  /** The EGL calls, from this context's own libEGL.dll; opaque outside. */
  struct Egl;

 private:
  Context();
  Api api_{};
  std::unique_ptr<Egl> egl_;
  void* egl_module_ = nullptr;
  void* gles_module_ = nullptr;
  void* display_ = nullptr;
  void* config_ = nullptr;
  void* surface_ = nullptr;
  void* context_ = nullptr;
};

}  // namespace feq::scene::gl
