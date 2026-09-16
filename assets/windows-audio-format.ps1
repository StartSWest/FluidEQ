# <FluidEQ: System-wide parametric audio equalizer interface>
# Copyright (C) <2026>  <Ivan Carmenates Garcia>
# SPDX-License-Identifier: GPL-3.0-or-later
#
# One output's shared-mode format — the "Default Format" in Sound settings —
# read, set to 7.1, or put back. Windows sends a game's or a film's surround
# channels only to an output whose format has that many channels, so the
# Room's one-press 7.1 is this: the same rate and bit depth the output has,
# eight channels, and the 7.1 speaker mask.
#
#   -DeviceId <id>                 read: channels, rate, bits, whether the
#                                  driver takes eight channels, and the format
#                                  as base64 so it can be put back
#   -DeviceId <id> -SetChannels 8  set, answering the previous format as base64
#   -DeviceId <id> -Restore <b64>  put a format read earlier back
#
# Through IPolicyConfig, the interface Sound settings itself uses, which needs
# no administrator: Windows restarts the output's streams on its own. Whether
# the driver takes eight channels is asked of IAudioClient in exclusive mode,
# which is the only question that reaches the driver rather than the mixer.
# JSON on stdout, one object; a failure is an object with `ok` false.

param(
    [Parameter(Mandatory = $true)][string]$DeviceId,
    [int]$SetChannels = 0,
    [string]$Restore = ''
)

$source = @'
using System;
using System.Runtime.InteropServices;

public static class FluidOutputFormat
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumeratorComObject { }

    [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    private class PolicyConfigClient { }

    // The vtable order is the one every public PolicyConfig definition
    // agrees on; only the four format calls carry their real signatures.
    [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPolicyConfig
    {
        [PreserveSig] int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string deviceId, out IntPtr format);
        [PreserveSig] int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string deviceId, int useDefault, out IntPtr format);
        [PreserveSig] int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
        [PreserveSig] int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string deviceId, IntPtr endpointFormat, IntPtr mixFormat);
        [PreserveSig] int GetProcessingPeriod();
        [PreserveSig] int SetProcessingPeriod();
        [PreserveSig] int GetShareMode();
        [PreserveSig] int SetShareMode();
        [PreserveSig] int GetPropertyValue();
        [PreserveSig] int SetPropertyValue();
        [PreserveSig] int SetDefaultEndpoint();
        [PreserveSig] int SetEndpointVisibility();
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, uint stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr endpoint);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr activationParams, out IntPtr instance);
        [PreserveSig] int OpenPropertyStore(uint access, out IntPtr properties);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out uint state);
    }

    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioClient
    {
        [PreserveSig] int Initialize();
        [PreserveSig] int GetBufferSize();
        [PreserveSig] int GetStreamLatency();
        [PreserveSig] int GetCurrentPadding();
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
    }

    private const int ShareModeExclusive = 1;
    private const uint ClsctxAll = 0x17;
    private const ushort FormatExtensible = 0xFFFE;
    private const ushort FormatFloat = 3;
    // FL FR FC LFE BL BR SL SR, in the order Windows lays 7.1 out.
    private const uint SevenPointOneMask = 0x63F;
    private static readonly Guid SubFormatPcm = new Guid("00000001-0000-0010-8000-00AA00389B71");
    private static readonly Guid SubFormatFloat = new Guid("00000003-0000-0010-8000-00AA00389B71");

    public class Answer
    {
        public bool ok { get; set; }
        public string error { get; set; }
        public int channels { get; set; }
        public int sampleRate { get; set; }
        public int bitsPerSample { get; set; }
        public Nullable<bool> takesEightChannels { get; set; }
        public string format { get; set; }
        public string previous { get; set; }
    }

    private static IMMDevice Device(string deviceId)
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
        IMMDevice device;
        Marshal.ThrowExceptionForHR(enumerator.GetDevice(deviceId, out device));
        return device;
    }

    /** The WAVEFORMATEX(TENSIBLE) bytes Windows runs this output at. */
    private static byte[] ReadFormat(string deviceId)
    {
        var policy = (IPolicyConfig)new PolicyConfigClient();
        IntPtr pointer;
        Marshal.ThrowExceptionForHR(policy.GetDeviceFormat(deviceId, 0, out pointer));
        try
        {
            var extra = Marshal.ReadInt16(pointer, 16);
            var bytes = new byte[18 + extra];
            Marshal.Copy(pointer, bytes, 0, bytes.Length);
            return bytes;
        }
        finally
        {
            Marshal.FreeCoTaskMem(pointer);
        }
    }

    /** The same rate with eight channels, the 7.1 mask and a given depth. */
    private static byte[] SevenPointOne(byte[] current, ushort bits, ushort validBits, Guid subFormat)
    {
        var rate = BitConverter.ToInt32(current, 4);
        const ushort channels = 8;
        var blockAlign = (ushort)(channels * bits / 8);
        var bytes = new byte[40];
        Array.Copy(BitConverter.GetBytes(FormatExtensible), 0, bytes, 0, 2);
        Array.Copy(BitConverter.GetBytes(channels), 0, bytes, 2, 2);
        Array.Copy(BitConverter.GetBytes(rate), 0, bytes, 4, 4);
        Array.Copy(BitConverter.GetBytes(rate * blockAlign), 0, bytes, 8, 4);
        Array.Copy(BitConverter.GetBytes(blockAlign), 0, bytes, 12, 2);
        Array.Copy(BitConverter.GetBytes(bits), 0, bytes, 14, 2);
        Array.Copy(BitConverter.GetBytes((ushort)22), 0, bytes, 16, 2);
        Array.Copy(BitConverter.GetBytes(validBits), 0, bytes, 18, 2);
        Array.Copy(BitConverter.GetBytes(SevenPointOneMask), 0, bytes, 20, 4);
        Array.Copy(subFormat.ToByteArray(), 0, bytes, 24, 16);
        return bytes;
    }

    /**
     * The 7.1 formats worth asking the driver about, the output's own depth
     * first: a driver that takes eight channels often takes them at one
     * depth only, and the Sound settings list is exactly these candidates.
     */
    private static byte[][] Candidates(byte[] current)
    {
        var tag = BitConverter.ToUInt16(current, 0);
        var bits = BitConverter.ToUInt16(current, 14);
        var validBits = current.Length >= 40 ? BitConverter.ToUInt16(current, 18) : bits;
        Guid subFormat;
        if (current.Length >= 40)
        {
            var guid = new byte[16];
            Array.Copy(current, 24, guid, 0, 16);
            subFormat = new Guid(guid);
        }
        else
        {
            subFormat = tag == FormatFloat ? SubFormatFloat : SubFormatPcm;
        }
        return new byte[][] {
            SevenPointOne(current, bits, validBits, subFormat),
            SevenPointOne(current, 24, 24, SubFormatPcm),
            SevenPointOne(current, 32, 24, SubFormatPcm),
            SevenPointOne(current, 16, 16, SubFormatPcm),
            SevenPointOne(current, 32, 32, SubFormatFloat)
        };
    }

    private static Nullable<bool> DriverTakes(string deviceId, byte[] format)
    {
        IntPtr client = IntPtr.Zero;
        IntPtr buffer = IntPtr.Zero;
        try
        {
            var device = Device(deviceId);
            var iid = typeof(IAudioClient).GUID;
            if (device.Activate(ref iid, ClsctxAll, IntPtr.Zero, out client) != 0 || client == IntPtr.Zero)
                return null;
            var audio = (IAudioClient)Marshal.GetObjectForIUnknown(client);
            buffer = Marshal.AllocCoTaskMem(format.Length);
            Marshal.Copy(format, 0, buffer, format.Length);
            IntPtr closest;
            var result = audio.IsFormatSupported(ShareModeExclusive, buffer, out closest);
            if (closest != IntPtr.Zero)
                Marshal.FreeCoTaskMem(closest);
            // S_OK is a yes. AUDCLNT_E_UNSUPPORTED_FORMAT is the driver's no;
            // any other failure is a driver that would not answer.
            if (result == 0)
                return true;
            if ((uint)result == 0x88890008)
                return false;
            return null;
        }
        catch (Exception)
        {
            return null;
        }
        finally
        {
            if (buffer != IntPtr.Zero)
                Marshal.FreeCoTaskMem(buffer);
            if (client != IntPtr.Zero)
                Marshal.Release(client);
        }
    }

    private static void Apply(string deviceId, byte[] format)
    {
        var policy = (IPolicyConfig)new PolicyConfigClient();
        var buffer = Marshal.AllocCoTaskMem(format.Length);
        try
        {
            Marshal.Copy(format, 0, buffer, format.Length);
            Marshal.ThrowExceptionForHR(policy.SetDeviceFormat(deviceId, buffer, buffer));
        }
        finally
        {
            Marshal.FreeCoTaskMem(buffer);
        }
    }

    public static Answer Read(string deviceId)
    {
        var current = ReadFormat(deviceId);
        var answer = new Answer {
            ok = true,
            channels = BitConverter.ToUInt16(current, 2),
            sampleRate = BitConverter.ToInt32(current, 4),
            bitsPerSample = BitConverter.ToUInt16(current, 14),
            format = Convert.ToBase64String(current)
        };
        // Two ways to a yes: the driver takes a 7.1 format in exclusive mode,
        // or Windows already knows the output as a set of six or more
        // physical speakers (the Configure wizard's choice), which is a driver
        // that mixes to them whatever it says about exclusive formats.
        answer.takesEightChannels = answer.channels >= 8
            ? (Nullable<bool>)true
            : (Takeable(deviceId, current) != null || PhysicalSpeakers(deviceId) >= 6);
        return answer;
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PROPERTYKEY key);
        [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
        [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
        [PreserveSig] int Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPERTYKEY
    {
        public Guid formatId;
        public uint propertyId;
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort valueType;
        [FieldOffset(8)] public uint uint32Value;
    }

    /** How many speakers Windows has this output configured for (0 unknown). */
    private static int PhysicalSpeakers(string deviceId)
    {
        try
        {
            var device = Device(deviceId);
            IntPtr storePointer;
            if (device.OpenPropertyStore(0, out storePointer) != 0)
                return 0;
            var store = (IPropertyStore)Marshal.GetObjectForIUnknown(storePointer);
            Marshal.Release(storePointer);
            // PKEY_AudioEndpoint_PhysicalSpeakers: a speaker mask.
            var key = new PROPERTYKEY {
                formatId = new Guid("1DA5D803-D492-4EDD-8C23-E0C0FFEE7F0E"),
                propertyId = 3
            };
            PROPVARIANT value;
            if (store.GetValue(ref key, out value) != 0)
                return 0;
            if (value.valueType != 19 && value.valueType != 3)
                return 0;
            var mask = value.uint32Value;
            var count = 0;
            while (mask != 0) { count += (int)(mask & 1); mask >>= 1; }
            return count;
        }
        catch (Exception)
        {
            return 0;
        }
    }

    /** The first 7.1 candidate the driver takes, or null. */
    private static byte[] Takeable(string deviceId, byte[] current)
    {
        foreach (var candidate in Candidates(current))
        {
            if (DriverTakes(deviceId, candidate) == true)
                return candidate;
        }
        return null;
    }

    public static Answer SetSevenPointOne(string deviceId)
    {
        var current = ReadFormat(deviceId);
        var format = Takeable(deviceId, current);
        if (format == null)
            return new Answer { ok = false, error = "the driver takes no 7.1 format" };
        Apply(deviceId, format);
        var after = ReadFormat(deviceId);
        return new Answer {
            ok = true,
            channels = BitConverter.ToUInt16(after, 2),
            sampleRate = BitConverter.ToInt32(after, 4),
            bitsPerSample = BitConverter.ToUInt16(after, 14),
            previous = Convert.ToBase64String(current)
        };
    }

    public static Answer Put(string deviceId, string base64)
    {
        Apply(deviceId, Convert.FromBase64String(base64));
        var after = ReadFormat(deviceId);
        return new Answer {
            ok = true,
            channels = BitConverter.ToUInt16(after, 2),
            sampleRate = BitConverter.ToInt32(after, 4),
            bitsPerSample = BitConverter.ToUInt16(after, 14)
        };
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

try {
    if ($Restore -ne '') {
        [FluidOutputFormat]::Put($DeviceId, $Restore) | ConvertTo-Json -Compress
    } elseif ($SetChannels -eq 8) {
        [FluidOutputFormat]::SetSevenPointOne($DeviceId) | ConvertTo-Json -Compress
    } elseif ($SetChannels -ne 0) {
        @{ ok = $false; error = "only 8 channels can be set" } | ConvertTo-Json -Compress
    } else {
        [FluidOutputFormat]::Read($DeviceId) | ConvertTo-Json -Compress
    }
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
