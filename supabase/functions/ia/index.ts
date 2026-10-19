// Lectura de fotos con IA (Google Gemini) para la versión publicada. Hace lo mismo que /__ia de serve.ps1:
//  · GET  → 204 si la clave está configurada (secreto GEMINI_API_KEY de Supabase), 404 si no. No revela nada más.
//  · POST → { prompt, images: [{ mime, data(base64) }] } y devuelve el texto (JSON) que responde Gemini.
// Solo con sesión de un usuario activo; la clave vive en los secretos de Supabase y nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const text = (b: string, status = 200, type = 'text/plain; charset=utf-8') => new Response(b, { status, headers: { ...cors, 'Content-Type': type } });
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('GEMINI_API_KEY');
  if (req.method === 'GET') return new Response(null, { status: key ? 204 : 404, headers: cors });
  if (req.method !== 'POST') return text('Método no permitido', 405);
  if (!key) return text('La IA no está configurada.', 404);

  // Quién pide: sesión iniciada y perfil activo (cualquier rol)
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });
  const { data: rol } = await caller.rpc('mi_rol');
  if (!rol) return text('Inicie sesión para usar la IA.', 401);

  if (Number(req.headers.get('content-length') || 0) > 30_000_000) return text('Las fotos son demasiado grandes.', 413);
  let b: { prompt?: unknown; images?: Array<{ mime?: unknown; data?: unknown }> };
  try { b = await req.json(); } catch { return text('Petición no válida.', 400); }
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, 6).filter(i => MIME.has(String(i?.mime)) && typeof i?.data === 'string');
  const parts: unknown[] = [{ text: String(b.prompt || '').slice(0, 20000) }, ...images.map(i => ({ inline_data: { mime_type: String(i.mime), data: String(i.data) } }))];

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
    });
    if (r.status === 429) return text('Error de la IA: se agotó la cuota gratuita por ahora. Intente más tarde.', 502);
    if (r.status === 401 || r.status === 403) return text('Error de la IA: la clave no es válida.', 502);
    if (!r.ok) { console.error('Gemini', r.status, await r.text()); return text('Error de la IA: no respondió. Intente de nuevo.', 502); }
    const j = await r.json();
    return text(String(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''), 200, 'application/json; charset=utf-8');
  } catch (e) {
    console.error('Gemini', e);   // el detalle queda en los registros de Supabase, no se envía
    return text('Error de la IA: no respondió. Revise la conexión.', 502);
  }
});
