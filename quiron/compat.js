// Compatibilidad con iPad y teléfonos con Safari antiguo. Este archivo está escrito a propósito en JavaScript antiguo
// (sin flechas, sin ?. ni ??) para que cargue en cualquier navegador y se ejecute antes que el resto.
// 1) Agrega las funciones modernas que faltan en Safari viejo.
// 2) Si el programa no logra arrancar, muestra un aviso con la versión del equipo en lugar de una pantalla negra.
(function () {
  function def(obj, name, fn) { if (!obj[name]) { try { Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); } catch (e) { obj[name] = fn; } } }
  def(Array.prototype, 'at', function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; });
  def(String.prototype, 'at', function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this.charAt(i) || undefined; });
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  def(String.prototype, 'replaceAll', function (a, b) { return a instanceof RegExp ? this.replace(a, b) : this.split(a).join(b); });
  def(Object, 'fromEntries', function (it) { var o = {}; Array.from(it).forEach(function (p) { o[p[0]] = p[1]; }); return o; });
  def(Array.prototype, 'flat', function (d) { d = d === undefined ? 1 : d; return this.reduce(function (a, x) { return a.concat(Array.isArray(x) && d > 0 ? x.flat(d - 1) : x); }, []); });
  def(Array.prototype, 'flatMap', function (f, t) { return this.map(f, t).flat(1); });
  if (typeof window.queueMicrotask !== 'function') window.queueMicrotask = function (f) { Promise.resolve().then(f); };
  if (typeof window.globalThis === 'undefined') window.globalThis = window;

  // Aviso si no arranca: con la versión de iOS para saber qué pasa
  var errors = [];
  window.addEventListener('error', function (e) { errors.push((e && e.message) || 'error'); });
  function ios() { var m = /OS (\d+)_(\d+)/.exec(navigator.userAgent); return m ? m[1] + '.' + m[2] : ''; }
  setTimeout(function () {
    var app = document.querySelector('.app'), auth = document.getElementById('auth');
    var started = (app && !app.hidden && document.getElementById('main') && document.getElementById('main').children.length) || (auth && !auth.hidden);
    if (started) return;
    var v = ios(), box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;top:0;left:0;right:0;bottom:0;z-index:99999;background:#111317;color:#f1f4f2;font:16px/1.5 -apple-system,Segoe UI,Arial,sans-serif;padding:32px;overflow:auto';
    box.innerHTML = '<div style="max-width:560px;margin:10vh auto"><h1 style="font-size:24px;margin:0 0 12px;color:#1fc79e">Quirón no pudo abrirse en este equipo</h1>' +
      '<p>' + (v ? 'Este equipo tiene <b>iOS ' + v + '</b>. ' : '') + 'El navegador no es compatible con el sistema. Pruebe actualizar el equipo en <b>Ajustes › General › Actualización de software</b>, o abra el sistema en otro equipo.</p>' +
      '<p style="color:#9ba49f;font-size:13px">Detalle para soporte: ' + (errors.slice(0, 2).join(' · ') || 'sin error registrado') + '<br>' + navigator.userAgent + '</p>' +
      '<p><button type="button" style="font:inherit;padding:10px 18px;border-radius:999px;border:0;background:#1fc79e;color:#05241d">Reintentar</button></p></div>';
    document.body.appendChild(box);
    box.querySelector('button').addEventListener('click', function () { location.reload(); });   // sin código dentro del HTML (política de seguridad)
  }, 9000);
})();
