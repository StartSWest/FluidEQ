/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

// In this order, and before anything of the window's: what the capture asked
// for is in storage before any setting reads it, and `window.electron` exists
// before the first module that looks at it.
import './prepare';
import 'main/preload';
import 'renderer/index';
