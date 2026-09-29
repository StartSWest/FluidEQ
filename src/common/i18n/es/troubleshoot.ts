const troubleshoot = {
  'troubleshoot.title': 'Solucionar problemas de audio',
  'troubleshoot.description':
    'Recorre la lista de arriba abajo y detente en el primer paso que funcione. Cada uno es más invasivo que el anterior, y el primero resuelve la mayoría de los problemas.',
  'troubleshoot.footer':
    '¿Sigue fallando después de todo eso? Usa **{report}** en el mismo menú: reúne los registros, quita todo lo que pueda identificarte y te lo muestra completo antes de enviar nada.',
  'troubleshoot.tried': 'Probado',
  'troubleshoot.restart.title': 'Reiniciar el audio de Windows',
  'troubleshoot.restart.when':
    'El sonido se ha detenido, o la gráfica se queda plana mientras algo suena. Es la solución en casi todos los casos y lo primero que hay que probar.',
  'troubleshoot.restart.cost':
    'Unos segundos de silencio. Windows pide permiso.',
  'troubleshoot.apo.reselect.title':
    'Vuelve a seleccionar tus dispositivos en Equalizer APO',
  'troubleshoot.apo.reselect.when':
    'Un dispositivo se ecualiza y otro no, o unos auriculares que acabas de conectar se ignoran. Equalizer APO se acopla a cada salida por separado, y un dispositivo nuevo no queda acoplado hasta que lo marcas.',
  'troubleshoot.apo.reselect.cost':
    'Abre el Device Selector de Equalizer APO. Después hay que reiniciar.',
  'troubleshoot.apo.openSelector': 'Abrir Device Selector',
  'troubleshoot.apo.mode.title': 'Prueba el otro modo de instalación',
  'troubleshoot.apo.mode.when':
    'Un dispositivo está marcado en el Device Selector y sigue sin efecto, o al marcarlo deja de sonar por completo. Equalizer APO puede acoplarse al audio de Windows de dos maneras, y algunos equipos solo funcionan con una de ellas.',
  'troubleshoot.apo.mode.cost':
    'Un reinicio. Es reversible: vuelve atrás de la misma manera.',
  'troubleshoot.apo.mode.detail':
    'En el Device Selector, abre **Troubleshooting options**. Lo predeterminado es instalar como **APO**, que funciona en la mayoría de los equipos. **Install as SFX/EFX** es la alternativa, y es la que conviene en dispositivos cuyos controladores traen sus propios efectos: mucho audio de portátiles y de gaming. Si un dispositivo dejó de funcionar al marcarlo, prueba el otro modo antes de concluir que no se puede ecualizar.',
  'troubleshoot.apo.reinstall.title': 'Reinstalar Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    'Los dos primeros no cambiaron nada, o Windows se actualizó y el ecualizador no ha vuelto a funcionar. Su instalador es también su herramienta de reparación: vuelve a registrar el componente de audio y abre de nuevo la lista de dispositivos.',
  'troubleshoot.apo.reinstall.cost':
    'Permiso de administrador, y después hay que reiniciar el equipo. Tus perfiles y presets de FluidEQ no se tocan.',
  'troubleshoot.apo.readd.title':
    'Quita el dispositivo, reinicia y vuelve a añadirlo',
  'troubleshoot.apo.readd.when':
    'Solo si un dispositivo concreto sigue fallando tras reinstalar. Desmárcalo en el Device Selector, reinicia el equipo, vuelve a marcarlo y reinicia una vez más.',
  'troubleshoot.apo.readd.cost': 'Dos reinicios.',
  'troubleshoot.apo.readd.detail':
    'Los dos reinicios no son superstición. Equalizer APO se acopla a un punto de audio al arrancar el equipo, así que un dispositivo desacoplado con Windows en marcha queda medio acoplado hasta que deja de estarlo, y volver a añadirlo antes de eso devuelve el estado defectuoso.',
  'troubleshoot.engine.enable.title':
    'Vuelve a poner el Motor FluidEQ en tus salidas',
  'troubleshoot.engine.enable.when':
    'Un dispositivo se ecualiza y otro no, o unos auriculares que acabas de conectar se ignoran. El motor se acopla a cada salida por separado, y una actualización de Windows puede desacoplarlo de una en la que ya estaba.',
  'troubleshoot.engine.permission':
    'Windows pide permiso y el audio se reinicia un momento. No hace falta reiniciar el equipo.',
  'troubleshoot.engine.remove.title': 'Quita el Motor FluidEQ de esta salida',
  'troubleshoot.engine.remove.when':
    'Esta salida falla de una forma que nada de lo anterior arregla, o quieres devolvérsela a otro programa de audio. El motor se quita de la salida por la que suena Windows ahora mismo, y lo que había reemplazado vuelve a su sitio.',
  'troubleshoot.engine.remove.cost':
    'Windows pide permiso y el audio se reinicia un momento. Tus otras salidas no se tocan, y el paso anterior vuelve a ponerlo.',
  'troubleshoot.engine.remove.action': 'Quitar de esta salida',
} as const;

export default troubleshoot;
