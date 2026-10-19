// Publicación en Vercel: copia la aplicación a dist/ y traduce el JavaScript para que funcione también en iPad y
// teléfonos con Safari antiguo (desde iOS 12). En este computador (serve.ps1) no se usa: se sirve el código tal cual.
// También guarda una copia traducida de la librería de Supabase (verificada con su huella) para no depender del CDN.
import { transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TARGET = ['safari12', 'ios12', 'chrome70', 'firefox68', 'edge79'];
const SKIP = new Set(['dist', 'node_modules', '_build.mjs', 'package.json', 'package-lock.json', 'vercel.json']);
const SUPABASE = { url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', sri: 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o' };

rmSync('dist', { recursive: true, force: true }); mkdirSync('dist');
for (const f of readdirSync('.')) { if (!SKIP.has(f)) cpSync(f, join('dist', f), { recursive: true }); }

let n = 0;
const lower = async (code, file) => (await transform(code, { loader: 'js', target: TARGET, charset: 'utf8', sourcefile: file, legalComments: 'inline' })).code;
for (const f of readdirSync('dist')) {
  const p = join('dist', f);
  if (!f.endsWith('.js') || f === 'compat.js' || !statSync(p).isFile()) continue;   // compat.js ya está en JavaScript antiguo
  writeFileSync(p, await lower(readFileSync(p, 'utf8'), f)); n++;
}

const res = await fetch(SUPABASE.url); if (!res.ok) throw new Error('No se pudo descargar supabase-js: ' + res.status);
const buf = Buffer.from(await res.arrayBuffer());
const got = 'sha384-' + createHash('sha384').update(buf).digest('base64');
if (got !== SUPABASE.sri) throw new Error('La huella de supabase-js no coincide: ' + got);
mkdirSync('dist/vendor', { recursive: true }); writeFileSync('dist/vendor/supabase.js', await lower(buf.toString('utf8'), 'supabase.js'));

console.log(`Listo: ${n} archivos traducidos para Safari antiguo + supabase-js verificado.`);
