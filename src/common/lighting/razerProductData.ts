/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The tables behind `razerProducts.ts`, as text: one product per line, so a
 * new Razer product is one line to add and the list reads like Razer's own.
 */

/**
 * `id class channel name`, one product per line; `-` for a product Razer's
 * table lists without saying which it is.
 *
 * Where Razer's table and the hardware disagree, the hardware wins:
 * - Mouse Dock Pro (00A4) is filed under mouse, but its LED map only makes
 *   sense against the mousepad's zones, and on a real desk it follows that
 *   channel.
 * - Base Station V2 Chroma (0F20) is missing from the table; its LED map
 *   samples the mousepad's zones, and it follows that channel.
 * - Kraken V4 Pro (0567, 0568) is filed under headset; on Razer Chroma 4 it
 *   follows the mousepad channel.
 * - Huntsman Signature Edition (02D8), V3 Tenkeyless 8KHz (02E5), V3 Pro
 *   Low-profile Tenkeyless 8KHz (02E6), V3 HE Magnetic Mini (02E4) and
 *   Tenkeyless 8KHz (02EA), and the BlackWidow V3 Pro over Bluetooth (025B),
 *   are lit keyboards newer than the table.
 */
export const RAZER_PRODUCTS = `
003E mouse mouse Razer Naga Epic Chroma
0043 mouse mouse Razer DeathAdder Chroma
0044 mouse mouse Razer Mamba Chroma
0045 mouse mouse Razer Mamba Chroma
0046 mouse mouse Razer Mamba Tournament Edition
0048 mouse mouse Razer Orochi
004C mouse mouse Razer Diamondback Chroma
0050 mouse mouse Razer Naga Hex V2
0053 mouse mouse Razer Naga Chroma
0059 mouse mouse Razer Lancehead
005A mouse mouse Razer Lancehead
005C mouse mouse Razer DeathAdder Elite
0060 mouse mouse Razer Lancehead Tournament Edition
0063 mouse mouse -
0064 mouse mouse Razer Basilisk
0065 mouse mouse Razer Basilisk Essential
0067 mouse mouse Razer Naga Trinity
0068 mousemat mousepad Razer Firefly Hyperflux
0069 mouse mouse Razer Mamba Hyperflux
006A mouse mouse Razer Abyssus Elite
006B mouse mouse Razer Abyssus Essential
006C mouse mouse Razer Mamba Elite
006F mouse mouse Razer Lancehead Wireless
0070 mouse mouse Razer Lancehead Wireless
0072 mouse mouse Razer Mamba Wireless
0073 mouse mouse Razer Mamba Wireless
0074 mouse mouse Razer Abyssus Lite
0075 mouse mouse Razer Turret Mouse Xbox One Edition
0078 mouse mouse Razer Viper
007A mouse mouse Razer Viper Ultimate
007B mouse mouse Razer Viper Ultimate
007C mouse mouse Razer DeathAdder V2 Pro
007D mouse mouse Razer DeathAdder V2 Pro
007E mouse mouse Razer Mouse Dock
0084 mouse mouse Razer DeathAdder V2
0085 mouse mouse Razer Basilisk V2
0086 mouse mouse Razer Basilisk Ultimate
0088 mouse mouse RazerBasiliskUltimateReceiver
008A mouse mouse Razer Viper Mini
008C mouse mouse Razer DeathAdder V2 Mini
008D mouse mouse Razer Naga Left Handed Edition 2020
008E mouse mouse -
008F mouse mouse Razer Naga Pro
0090 mouse mouse Razer Naga Pro
0091 mouse mouse Razer Viper 8KHz
0092 mouse mouse -
0093 mouse mouse Razer Naga Classic
0094 mouse mouse Razer Orochi V2
0096 mouse mouse Razer Naga X
0099 mouse mouse Razer Basilisk V3
009A mouse mouse Razer Pro Click Mini
009C mouse mouse Razer DeathAdder V2 X HyperSpeed
00A1 mouse mouse Razer DeathAdder V2 Lite
00A3 mouse mouse Razer Cobra
00A4 mouse mousepad Razer Mouse Dock Pro
00A6 mouse mouse Razer Viper V2 Pro
00A7 mouse mouse Razer Naga V2 Pro
00A8 mouse mouse Razer Naga V2 Pro
00A9 mouse mouse -
00AA mouse mouse Razer Basilisk V3 Pro
00AB mouse mouse Razer Basilisk V3 Pro
00AC mouse mouse Razer Basilisk V3 Pro
00AF mouse mouse Razer Cobra Pro
00B0 mouse mouse Razer Cobra Pro
00B1 mouse mouse -
00B3 mouse mouse Razer HyperPolling Wireless Dongle
00B4 mouse mouse Razer Naga V2 HyperSpeed
00B7 mouse mouse Razer DeathAdder V3 Pro
00B8 mouse mouse Razer Viper V3 HyperSpeed
00B9 mouse mouse Razer Basilisk V3 X HyperSpeed
00BA mouse mouse -
00C1 mouse mouse Razer Viper V3 Pro
00C5 mouse mouse Razer DeathAdder V3 HyperSpeed
00C7 mouse mouse Razer Pro Click V2 Vertical Edition
00C8 mouse mouse Razer Pro Click V2 Vertical Edition
00C9 mouse mouse -
00CB mouse mouse Razer Basilisk V3 35K
00CC mouse mouse Razer Basilisk V3 Pro 35K
00CD mouse mouse Razer Basilisk V3 Pro 35K
00CE mouse mouse -
00CF mouse mouse Razer HyperFlux V2
00D0 mouse mouse Razer Pro Click V2
00D1 mouse mouse Razer Pro Click V2
00D2 mouse mouse -
00D3 mouse mouse Razer Basilisk Mobile
00D4 mouse mouse Razer Basilisk Mobile
00D5 mouse mouse -
00D6 mouse mouse Razer Basilisk V3 Pro 35K Phantom Green Edition
00D7 mouse mouse Razer Basilisk V3 Pro 35K Phantom Green Edition
00D8 mouse mouse Razer Basilisk V3 Pro 35K Phantom Green Edition
00DA mouse mouse -
00DB mouse mouse Razer Cobra HyperSpeed
00DC mouse mouse -
00E2 mouse mouse -
00E3 mouse mouse -
00E4 mouse mouse -
00E7 mouse mouse Razer Naga V3 Pro
00E8 mouse mouse Razer Naga V3 Pro
00E9 mouse mouse -
00EA mouse mouse -
00EB mouse mouse -
00F1 mouse mouse -
01A2 external chromalink -
0203 keyboard keyboard Razer BlackWidow Chroma
0204 keyboard keyboard Razer DeathStalker Chroma
0205 system keyboard Razer Blade Stealth
0207 keypad keypad Razer Orbweaver Chroma
0208 keypad keypad Razer Tartarus Chroma
0209 keyboard keyboard Razer BlackWidow Tournament Edition Chroma
020F system keyboard Razer Blade
0210 system keyboard Razer Blade Pro
0211 keyboard keyboard Razer BlackWidow Chroma
0215 chromamodule chromalink Razer Core
0216 keyboard keyboard Razer BlackWidow X Chroma
021A keyboard keyboard Razer BlackWidow X Tournament Edition Chroma
021E keyboard keyboard Razer Ornata Chroma
0220 system keyboard Razer Blade Stealth
0221 keyboard keyboard BlackWidow Chroma V2
0223 system keyboard -
0224 system keyboard Razer Blade
0225 system keyboard Razer Blade Pro
0226 keyboard keyboard Razer Huntsman Elite
0227 keyboard keyboard Razer Huntsman
0228 keyboard keyboard Razer BlackWidow Elite
022A keyboard keyboard Razer Cynosa Chroma
022B keypad keypad Razer Tartarus V2
022C keyboard keyboard Razer Cynosa Chroma Pro
022D system keyboard Razer Blade Stealth
022F system keyboard Razer Blade Pro FullHD
0232 system keyboard Razer Blade Stealth
0233 system keyboard Razer Blade 15
0234 system keyboard Razer Blade Pro 17
0239 system chromalink Razer Blade Stealth
023A system keyboard Razer Blade 15 Advanced
023B system chromalink Razer Blade 15 Base Model
023E keyboard keyboard Razer Turret Keyboard Xbox One Edition
023F keyboard keyboard Razer Cynosa Lite
0240 system keyboard Razer Blade 15 Mercury
0241 keyboard keyboard Razer BlackWidow 2019
0243 keyboard keyboard Razer Huntsman Tournament Edition
0244 keypad keypad Razer Tartarus Pro
0245 system keyboard Razer Blade 15 Mercury
0246 system chromalink Razer Blade 15 Base Model
024A system chromalink Razer Blade Stealth
024B system keyboard Razer Blade Advanced
024C system keyboard Razer Blade Pro
024D system keyboard Razer Blade 15 Studio Edition
024E keyboard keyboard Razer BlackWidow V3
0252 system chromalink Razer Blade Stealth
0253 system keyboard Razer Blade 15 Advanced
0254 system keyboard -
0255 system chromalink Razer Blade Base
0256 system keyboard Razer Blade Pro
0257 keyboard keyboard Razer Huntsman Mini
0258 keyboard keyboard Razer BlackWidow V3 Mini HyperSpeed
0259 system chromalink Razer Blade Stealth
025A keyboard keyboard Razer BlackWidow V3 Pro Wired
025B keyboard keyboard Razer BlackWidow V3 Pro
025C keyboard keyboard Razer BlackWidow V3 Pro 2.4 Ghz Wireless
025D keyboard keyboard Razer Ornata V2
025E keyboard keyboard Razer Cynosa V2
0266 keyboard keyboard Razer Huntsman V2 Analog
0268 system chromalink Razer Blade Late 2020 Base
0269 keyboard keyboard Razer Huntsman Mini JP
026A system keyboard Razer Book
026B keyboard keyboard Razer Huntsman V2 Tenkeyless
026C keyboard keyboard Razer Huntsman V2
026D system keyboard Razer Blade 15 Advanced
026E system keyboard Razer Blade 17 Pro
026F system chromalink Razer Blade Base
0270 system keyboard Razer Blade 14
0271 keyboard keyboard Razer BlackWidow V3 Mini HyperSpeed
0276 system keyboard Razer Blade 15 Advanced
0279 system keyboard Razer Blade 17 Pro
027A system chromalink Razer Blade Base
0282 keyboard keyboard Razer Huntsman Mini Analog
0287 keyboard keyboard Razer BlackWidow V4
028A system keyboard Razer Blade 15 Advanced
028B system keyboard Razer Blade 17
028C system keyboard Razer Blade 14
028D keyboard keyboard Razer BlackWidow V4 Pro
028F keyboard chromalink Razer Ornata V3
0290 keyboard keyboard Razer DeathStalker V2 Pro
0292 keyboard keyboard Razer DeathStalker V2 Pro
0293 keyboard keyboard Razer BlackWidow V4 X
0294 keyboard chromalink Razer Ornata V3 X
0295 keyboard keyboard Razer DeathStalker V2
0296 keyboard keyboard Razer DeathStalker V2 Pro TKL
0298 keyboard keyboard Razer DeathStalker V2 Pro TKL
029D system keyboard Razer Blade 14
029E system keyboard Razer Blade 15
029F system keyboard Razer Blade 16
02A0 system keyboard Razer Blade 18
02A1 keyboard chromalink Razer Ornata V3
02A2 keyboard chromalink Razer Ornata V3 X
02A3 keyboard chromalink Razer Ornata V3 Tenkeyless
02A5 keyboard keyboard Razer BlackWidow V4 75%
02A6 keyboard keyboard Razer Huntsman V3 Pro
02A7 keyboard keyboard Razer Huntsman V3 Pro TKL
02A8 keyboard keyboard -
02B0 keyboard keyboard Razer Huntsman V3 Pro Mini
02B1 keyboard keyboard Razer Huntsman V3 X Tenkeyless
02B3 keyboard keyboard Razer Blackwidow V4 Pro 75%
02B4 keyboard keyboard Razer Blackwidow V4 Pro 75%
02B6 system keyboard Razer Blade 14
02B7 system keyboard Razer Blade
02B8 system keyboard Razer Blade 18
02B9 keyboard keyboard Razer BlackWidow V4 Mini HyperSpeed
02BA keyboard keyboard Razer BlackWidow V4 Mini HyperSpeed
02C2 keyboard chromalink Razer Pro Type Ergo
02C4 keyboard chromalink Razer Pro Type Ergo
02C5 system keyboard Razer Blade 14
02C6 system keyboard Razer Blade 16
02C7 system keyboard Razer Blade 18
02C9 keyboard keyboard Razer BlackWidow V4 Low-profile HyperSpeed
02CC keyboard keyboard Razer BlackWidow V4 Low-profile HyperSpeed
02CD keyboard chromalink Razer Joro
02CF keyboard keyboard Razer Huntsman V3 Pro 8KHz
02D0 keyboard keyboard Razer Huntsman V3 Pro Tenkeyless 8KHz
02D1 keyboard keyboard -
02D2 keyboard keyboard Razer Blackwidow V4 Low Profile TKL
02D4 keyboard keyboard Razer Blackwidow V4 Low Profile TKL
02D5 keyboard keyboard Razer BlackWidow V4 Tenkeyless HyperSpeed
02D7 keyboard keyboard Razer BlackWidow V4 Tenkeyless HyperSpeed
02D8 keyboard keyboard Razer Huntsman Signature Edition
02DA keyboard chromalink -
02E4 keyboard keyboard Razer Huntsman V3 HE Magnetic Mini
02E5 keyboard keyboard Razer Huntsman V3 Tenkeyless 8KHz
02E6 keyboard keyboard Razer Huntsman V3 Pro Low-profile Tenkeyless 8KHz
02EA keyboard keyboard Razer Huntsman V3 HE Magnetic Tenkeyless 8KHz
0309 headset chromalink -
030A external chromalink -
030C accessory chromalink -
030D accessory chromalink Razer Aether Lamp Pro
030E accessory chromalink -
030F accessory chromalink -
0310 accessory chromalink Razer Aether Light Strip
0312 accessory mousepad -
0316 accessory mousepad -
0317 accessory chromalink Razer Aether Standing Light Bars
0333 external chromalink -
0504 headset headset Razer Kraken 7.1 Chroma
0510 headset headset Razer Kraken 7.1 V2
0517 speaker headset Razer Nommo Chroma
0518 speaker headset Razer Nommo Pro
051A headset headset Razer Nari Ultimate
051C headset headset Razer Nari
0527 headset headset Razer Kraken Ultimate
052C headset chromalink Razer Kraken V3 Pro
0530 headset chromalink Razer Kraken BT Kitty Edition
0532 speaker mousepad Razer Leviathan V2
0533 headset chromalink Razer Kraken V3 HyperSense
0534 headset chromalink -
0537 headset chromalink Razer Kraken V3 X
0548 speaker mousepad Razer Leviathan V2 Pro
0549 headset chromalink Razer Kraken V3
054A speaker mousepad Razer Leviathan V2 X
0554 headset chromalink Razer Kraken Kitty V2 Pro
055A speaker headset Razer Nommo V2 Pro
055C speaker headset Razer Nommo V2
0560 headset chromalink Razer Kraken Kitty V2
0562 headset headset Razer Kraken Kitty V2 BT
0567 headset mousepad Razer Kraken V4 Pro
0568 headset mousepad Razer Kraken V4 Pro
056B headset headset Razer Kraken V4
056C headset headset Razer Kraken V4
056D headset headset Razer Kraken V4 X
056F accessory chromalink Razer Seiren V3 Chroma
0574 headset headset Razer Barracuda X Chroma
057E headset headset -
057F headset headset -
0580 headset headset -
0582 headset chromalink -
0587 headset headset Razer Kraken Kitty V3 Pro
0588 headset headset Razer Kraken Kitty V3 Pro
058A headset chromalink Razer Kraken Kitty V2
058E accessory mousepad -
05A3 speaker mousepad -
0904 keyboard keyboard Razer Turret Receiver
0A02 headset headset ManO'War
0A21 keyboard keyboard -
0A23 keyboard keyboard -
0A24 keyboard keyboard Razer BlackWidow V3 TK
0C00 mousemat mousepad Razer Firefly
0C01 mousemat chromalink Razer Goliathus
0C02 mousemat chromalink Razer Goliathus Extended
0C04 mousemat mousepad Razer Firefly V2
0C05 mousemat mousepad Razer Strider Chroma
0C06 mousemat chromalink Razer Goliathus Chroma 3XL
0C08 mousemat mousepad Razer Firefly V2 Pro
0F00 external chromalink -
0F01 external chromalink -
0F03 headset headset Razer Tiamat 7.1 V2
0F04 chromamodule chromalink -
0F07 accessory mousepad Razer Chroma Mug Holder
0F08 accessory mousepad Razer Base Station Chroma
0F09 chromamodule chromalink Razer Chroma Hardware Development Kit
0F0C chromamodule chromalink -
0F0D accessory mousepad Razer Laptop Stand Chroma
0F0E chromamodule chromalink Razer Chroma PC Case Lighting Kit
0F12 chromamodule mousepad Razer Raptor 27
0F13 chromamodule chromalink Lian Li O11 Dynamic - Razer Edition
0F17 chromamodule chromalink Razer Tomahawk ATX
0F19 headset chromalink Razer Kraken Kitty Edition
0F1A chromamodule chromalink Razer Core X Chroma
0F1B accessory chromalink Razer Seiren Emote
0F1C accessory chromalink -
0F1D accessory mousepad Razer Mouse Bungee V3 Chroma
0F1F accessory chromalink Razer Chroma Addressable RGB Controller
0F20 accessory mousepad Razer Base Station V2 Chroma
0F21 chromamodule mousepad Razer Thunderbolt 4 Dock Chroma
0F26 accessory mousepad Razer Charging Pad Chroma
0F27 chromamodule chromalink Razer Tomahawk Gaming Desktop
0F28 chromamodule mousepad Razer Raptor 27 165Hz
0F2B accessory mousepad Razer Laptop Stand Chroma V2
0F2C accessory chromalink -
0F33 accessory chromalink -
0F35 accessory chromalink Razer Hanbo Chroma
0F36 accessory chromalink -
0F43 accessory mousepad Razer Laptop Cooling Pad
0F52 chromamodule mousepad Razer Thunderbolt 5 Dock Chroma
0F59 accessory mousepad Razer Monitor Stand Chroma
0F5C accessory mousepad Razer Handheld Dock Chroma
0F64 accessory mousepad Razer Soma Chroma
0F66 accessory mousepad -
0F6A accessory mousepad -
0F6C accessory mousepad -
1013 accessory mousepad -
1407 chromamodule mousepad -
B00A mouse mouse -
B00B mouse mouse -
`;

/**
 * Ids Razer Chroma cannot light: products made without Chroma (DeathAdder
 * V3, BlackShark V3, Wolverine V3 Tournament Edition), receivers, hubs and
 * docks, and the unlit second interface of a lit product — a Base Station V2
 * Chroma's media keys (48F0), a Monitor Stand Chroma's display function
 * (0F69).
 */
export const RAZER_UNLIT = `
0024 0025 004D 005E 006E 0071 0077 0098 009F 00B2 00B6 00BF
00C0 00C2 00C3 00DF 00E0 00E5 00FD 0111 0118 011B 011D 011F
0201 020D 0214 0217 021F 0235 0237 0249 027B 0300 0511 051E
051F 0520 0521 0524 0526 0528 0529 0536 053A 053C 053E 0544
0552 0555 0565 056A 0570 0577 057A 057D 0A00 0A14 0A29 0A2E
0A3A 0A3F 0A45 0A57 0A59 0A5A 0A61 0D06 0D09 0E05 0F2F 0F30
0F3C 0F45 0F4E 0F53 0F57 0F69 1004 1007 100C 122E 1507 48F0
`;

/**
 * Razer's LED maps for mousepad-channel products. A Mouse Dock Pro's eight
 * LEDs sample the rim all the way round, a laptop stand's fifteen run down
 * the left edge, along the bottom and up the right, and a Strider Chroma's
 * nineteen go round its whole edge.
 */
export const RAZER_ZONES = `
0C04 16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,18,17
0C05 11,10,9,8,7,6,5,4,3,2,1,0,19,18,17,16,15,14,13
0C08 14,13,11,10,9,9,8,8,7,6,6,5,5,4,3,1,0
0F1D 0,2,4,6,8,10,12,14
0F20 0,2,4,6,8,10,12,14
0F26 0,2,4,5,6,8,9,10,12,14
0F2B 14,13,12,11,10,9,8,7,6,5,4,3,2,1,0
0F43 14,13,12,12,11,10,9,8,7,7,6,5,4,3,2,2,1,0
0F59 14,13,13,12,12,11,11,10,10,9,9,8,8,7,7,6,6,5,5,4,4,3,3,2,2,1,1,0
0F5C 0,2,4,6,8,10,12,14
0F21 14,12,10,9,8,7,7,6,5,4,2,0
0F52 13,12,11,10,9,9,8,8,7,7,6,6,5,5,4,3,2,1
0F12 14,12,10,9,8,7,7,6,5,4,2,0
0F28 14,12,10,9,8,7,7,6,5,4,2,0
0532 0,0,1,2,3,4,5,6,7,7,8,9,10,11,12,13,14,14
054A 14,13,12,11,10,9,8,6,5,4,3,2,1,0
0548 14,14,13,13,12,12,11,11,10,10,9,9,8,8,7,7,6,6,5,5,4,4,3,3,2,2,1,1,0,0
05A3 0,0,1,2,3,4,5,6,7,7,8,9,10,11,12,13,14,14
00A4 10,7,4,2,0,17,14,12
0F6A 8,9,11,13,15,16,18,19,1,3,5,6
058E 8,9,11,13,15,16,18,19,1,3,5,6
0F6C 17,18,19,0,2,4,5,6,7,8,9,10,12,14,15,16
1407 14,12,10,9,8,7,7,6,5,4,2,0
`;
