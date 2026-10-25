/* FluidEQ — GPL-3.0-or-later */
export const BUS_NAME = 'app.fluideq.Desktop';
export const OBJECT_PATH = '/app/fluideq/Desktop';
export const INTERFACE = `<node><interface name="${BUS_NAME}">
  <method name="Attach"><arg type="u" direction="in"/><arg type="u" direction="in"/></method>
  <method name="SetVisible"><arg type="b" direction="in"/></method>
  <method name="SetColour"><arg type="u" direction="in"/><arg type="s" direction="in"/></method>
  <method name="Detach"/>
  <signal name="Report"><arg type="s"/></signal>
</interface></node>`;
