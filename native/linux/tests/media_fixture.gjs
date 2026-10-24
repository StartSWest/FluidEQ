/* FluidEQ — GPL-3.0-or-later; isolated MPRIS test player, no audio or desktop. */
const { Gio, GLib } = imports.gi;
const name = ARGV[0];
const loop = GLib.MainLoop.new(null, false);
const xml = `<node><interface name="org.mpris.MediaPlayer2.Player">
<method name="Next"/><method name="Previous"/><method name="PlayPause"/>
<method name="Pause"/><method name="Stop"/>
<method name="SetPosition"><arg name="track" type="o" direction="in"/><arg name="position" type="x" direction="in"/></method>
<signal name="Seeked"><arg name="position" type="x"/></signal>
<property name="PlaybackStatus" type="s" access="read"/>
<property name="Position" type="x" access="read"/>
<property name="Metadata" type="a{sv}" access="read"/>
<property name="CanControl" type="b" access="read"/>
<property name="CanGoNext" type="b" access="read"/>
<property name="CanGoPrevious" type="b" access="read"/>
<property name="CanSeek" type="b" access="read"/>
</interface><interface name="org.fluideq.Test">
<method name="SetTitle"><arg name="title" type="s" direction="in"/></method>
<method name="SetPlaying"><arg name="playing" type="b" direction="in"/></method>
<method name="SetArtwork"><arg name="uri" type="s" direction="in"/></method>
<method name="Seek"><arg name="position" type="x" direction="in"/></method>
<method name="SetControls"><arg name="enabled" type="b" direction="in"/></method>
<method name="Quit"/>
</interface></node>`;
let player;
let controls;
let title = 'First song';
let artwork = '';
let playing = false;
let position = 42000000;
let enabled = true;
const metadata = () => ({
  'mpris:trackid': new GLib.Variant('o', '/org/fluideq/test/track1'),
  'mpris:length': new GLib.Variant('x', 180000000),
  'mpris:artUrl': new GLib.Variant('s', artwork),
  'xesam:title': new GLib.Variant('s', title),
  'xesam:artist': new GLib.Variant('as', ['Artist one', 'Artist two']),
});
const setPlaying = (value) => {
  playing = value;
  player.emit_property_changed('PlaybackStatus', new GLib.Variant('s', playing ? 'Playing' : 'Paused'));
};
const object = {
  get PlaybackStatus() { return playing ? 'Playing' : 'Paused'; },
  get Position() { return position; },
  get Metadata() { return metadata(); },
  get CanControl() { return enabled; },
  get CanGoNext() { return enabled; },
  get CanGoPrevious() { return false; },
  get CanSeek() { return enabled; },
  Next() { print('command next'); },
  Previous() { print('command previous'); },
  PlayPause() { print('command playPause'); setPlaying(!playing); },
  Pause() { print('command pause'); setPlaying(false); },
  Stop() { print('command stop'); setPlaying(false); position = 0; },
  SetPosition(track, value) {
    print(`command seek ${track} ${value}`);
    position = value;
    player.emit_signal('Seeked', new GLib.Variant('(x)', [position]));
  },
};
const test = {
  SetTitle(value) { title = value; player.emit_property_changed('Metadata', new GLib.Variant('a{sv}', metadata())); },
  SetPlaying: setPlaying,
  SetArtwork(value) { artwork = value; player.emit_property_changed('Metadata', new GLib.Variant('a{sv}', metadata())); },
  Seek(value) { position = value; player.emit_signal('Seeked', new GLib.Variant('(x)', [value])); },
  SetControls(value) { enabled = value; player.emit_property_changed('CanControl', new GLib.Variant('b', value)); },
  Quit() { loop.quit(); },
};
Gio.bus_own_name(Gio.BusType.SESSION, name, Gio.BusNameOwnerFlags.NONE,
  (connection) => {
    const info = Gio.DBusNodeInfo.new_for_xml(xml);
    player = Gio.DBusExportedObject.wrapJSObject(info.interfaces[0], object);
    controls = Gio.DBusExportedObject.wrapJSObject(info.interfaces[1], test);
    player.export(connection, '/org/mpris/MediaPlayer2');
    controls.export(connection, '/org/mpris/MediaPlayer2');
  }, () => print('ready'), () => loop.quit());
loop.run();
