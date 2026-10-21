// Usuarios del sistema (solo la administración): invitar, generar un enlace nuevo y activar o desactivar.
// Corre en Supabase, donde la llave maestra (SUPABASE_SERVICE_ROLE_KEY) existe sola y nunca llega al navegador.
// Los enlaces se devuelven a la aplicación para enviarlos por WhatsApp: no depende del correo.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ROLES = ['admin', 'medico', 'anestesiologo', 'residente', 'enfermeria_plus', 'enfermeria', 'almacen', 'recepcion', 'laboratorio', 'imagen'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Quién llama: con su propia sesión, y solo si es administrador activo
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });
    const { data: yo } = await caller.auth.getUser();
    const { data: esAdmin } = await caller.rpc('es_admin');
    if (!yo?.user || !esAdmin) return json({ error: 'Solo la administración puede gestionar usuarios.' }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const b = await req.json();
    // A dónde vuelve el enlace: solo la propia aplicación (https) o el equipo local de pruebas
    const volver = typeof b.volver === 'string' && /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)$/i.test(b.volver) ? b.volver : undefined;

    if (b.accion === 'invitar') {
      const nombre = String(b.nombre || '').trim(), correo = String(b.correo || '').trim().toLowerCase(), rol = String(b.rol || '');
      if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !ROLES.includes(rol)) return json({ error: 'Datos incompletos o rol no válido.' }, 400);
      const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email: correo, options: { redirectTo: volver } });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? 'Ya existe una cuenta con ese correo.' : error.message }, 400);
      const { data: perfil, error: e2 } = await admin.from('perfiles')
        .insert({ id: data.user.id, nombre, correo, rol, doc: b.doc || null, estado: 'invitado', creado_por: yo.user.id }).select().single();
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
      return json({ perfil, enlace: data.properties.action_link });
    }

    if (b.accion === 'enlace') {   // contraseña olvidada o invitación vencida: enlace para crear una contraseña nueva
      const { data: u, error } = await admin.auth.admin.getUserById(String(b.id));
      if (error || !u?.user?.email) return json({ error: 'Usuario no encontrado.' }, 404);
      const { data, error: e2 } = await admin.auth.admin.generateLink({ type: 'recovery', email: u.user.email, options: { redirectTo: volver } });
      if (e2) return json({ error: e2.message }, 400);
      return json({ enlace: data.properties.action_link });
    }

    if (b.accion === 'estado') {
      const estado = String(b.estado), id = String(b.id);
      if (!['activo', 'desactivado'].includes(estado)) return json({ error: 'Estado no válido.' }, 400);
      if (id === yo.user.id) return json({ error: 'No puede desactivar su propia cuenta.' }, 400);
      const { data: p } = await admin.from('perfiles').select('estado').eq('id', id).single();
      const nuevo = estado === 'activo' && p?.estado === 'invitado' ? 'invitado' : estado;   // reactivar a quien no ha entrado lo deja invitado
      const { error } = await admin.from('perfiles').update({ estado: nuevo }).eq('id', id); if (error) return json({ error: error.message }, 400);
      await admin.auth.admin.updateUserById(id, { ban_duration: estado === 'desactivado' ? '876000h' : 'none' });   // desactivado: no puede iniciar sesión
      return json({ ok: true, estado: nuevo });
    }
    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
