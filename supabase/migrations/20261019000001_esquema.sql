-- Quirón Dos · esquema inicial en Supabase
--
-- Diseño: una tabla por módulo y una fila por registro (paciente, examen, ingreso…). Cada fila guarda el registro
-- completo en `data` (jsonb, el mismo objeto que usa la aplicación) y algunas columnas extraídas para buscar y para
-- los permisos (pid = paciente). La aplicación sigue trabajando con sus objetos; la capa de datos (quiron/cloud.js)
-- envía solo los registros que cambiaron y recibe en tiempo real los cambios de los demás equipos.
--
-- Permisos (RLS): cada tabla dice qué roles la LEEN y qué roles la ESCRIBEN. El rol sale de public.perfiles,
-- nunca del navegador. Ver la matriz en `select * from public.acceso order by tabla`.

-- ---------------------------------------------------------------- Perfiles y rol
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  rol text not null check (rol in ('admin','medico','residente','enfermeria_plus','enfermeria','almacen','recepcion','laboratorio','imagen')),
  doc text,                                   -- ficha de médico vinculada (S.doctors[].id)
  estado text not null default 'activo' check (estado in ('activo','invitado','desactivado')),
  datos jsonb not null default '{}'::jsonb,   -- cédula, colegio, MPPS, tutoriales vistos…
  creado timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
alter table public.perfiles enable row level security;

-- Rol del usuario conectado (solo si está activo). security definer: lee perfiles sin pasar por su propia RLS.
create or replace function public.mi_rol() returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and estado = 'activo'
$$;
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'admin', false)
$$;

create policy perfiles_leer on public.perfiles for select to authenticated using (public.mi_rol() is not null);
create policy perfiles_admin on public.perfiles for all to authenticated using (public.es_admin()) with check (public.es_admin());
-- Cada quien actualiza sus propios datos profesionales y preferencias, pero no su rol ni su estado
create policy perfiles_propio on public.perfiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and rol = (select p.rol from public.perfiles p where p.id = auth.uid()) and estado = 'activo');

-- ---------------------------------------------------------------- Matriz de acceso
create table public.acceso (
  tabla text primary key,
  leen text[] not null,      -- roles que leen
  escriben text[] not null,  -- roles que crean y modifican
  nota text
);
alter table public.acceso enable row level security;
create policy acceso_leer on public.acceso for select to authenticated using (true);

-- Grupos de roles (para leer la matriz más fácil)
--   todos     : todos los roles
--   clinicos  : admin, medico, residente, enfermeria_plus, enfermeria
--   medicos   : admin, medico, residente
insert into public.acceso (tabla, leen, escriben, nota) values
  -- Pacientes y clínica
  ('pacientes',      '{admin,medico,residente,enfermeria_plus,enfermeria,almacen,recepcion,laboratorio,imagen}', '{admin,medico,residente,recepcion,laboratorio}', 'Ficha, alergias y antecedentes'),
  ('citas',          '{admin,medico,residente,enfermeria_plus,enfermeria,almacen,recepcion}', '{admin,medico,residente,enfermeria_plus,almacen,recepcion}', 'Agenda: consultas y cirugías'),
  ('consultas',      '{admin,medico,residente}', '{admin,medico,residente}', 'Consultas guiadas firmadas'),
  ('notas_clinicas', '{admin,medico,residente}', '{admin,medico,residente}', 'Historia clínica (S.hc)'),
  ('historias',      '{admin,medico,residente}', '{admin,medico,residente}', 'Historias escaneadas e índice (S.records)'),
  ('ingresos',       '{admin,medico,residente,enfermeria_plus,enfermeria,almacen}', '{admin,medico,residente,enfermeria_plus,enfermeria}', 'Hospitalización y emergencias'),
  ('evoluciones',    '{admin,medico,residente,enfermeria_plus,enfermeria}', '{admin,medico,residente}', ''),
  ('indicaciones',   '{admin,medico,residente,enfermeria_plus,enfermeria}', '{admin,medico,residente,enfermeria_plus,enfermeria}', 'Enfermería registra cada dosis'),
  ('ordenes_med',    '{admin,medico,residente,enfermeria_plus,enfermeria,almacen}', '{admin,medico,residente,enfermeria_plus,enfermeria,almacen}', 'Solicitudes al almacén (S.medOrders)'),
  ('aplicaciones',   '{admin,medico,residente,enfermeria_plus,enfermeria}', '{admin,enfermeria_plus,enfermeria,medico,residente}', 'S.mar'),
  ('triaje',         '{admin,medico,residente,enfermeria_plus,enfermeria}', '{admin,medico,residente,enfermeria_plus,enfermeria}', ''),
  ('examenes',       '{admin,medico,residente,enfermeria_plus,enfermeria,laboratorio,imagen}', '{admin,medico,residente,laboratorio,imagen}', ''),
  ('derivaciones',   '{admin,medico,residente,recepcion}', '{admin,medico,residente,recepcion}', ''),
  ('plantillas',     '{admin,medico,residente}', '{admin,medico,residente}', 'Plantillas de órdenes'),
  ('kits',           '{admin,medico,residente,enfermeria_plus,almacen,recepcion}', '{admin}', 'Kits de cirugía'),
  -- Inventario
  ('productos',      '{admin,medico,residente,enfermeria_plus,enfermeria,almacen}', '{admin,almacen,enfermeria_plus,enfermeria,medico,residente}', 'La existencia baja al despachar, devolver o cobrar'),
  ('movimientos',    '{admin,almacen}', '{admin,almacen,enfermeria_plus,enfermeria,medico,residente,recepcion}', 'Se crean al mover inventario'),
  ('proveedores',    '{admin,almacen}', '{admin,almacen}', ''),
  ('compras',        '{admin,almacen}', '{admin,almacen}', 'Órdenes de compra (S.orders)'),
  -- Dinero (solo Administración lee; algunos roles crean la cuenta al dar de alta o atender)
  ('cuentas',        '{admin}', '{admin,medico,residente,recepcion}', 'Cobros y facturas (S.invoices)'),
  ('presupuestos',   '{admin}', '{admin}', ''),
  ('contabilidad',   '{admin}', '{admin}', 'S.ledger'),
  ('recurrentes',    '{admin}', '{admin}', ''),
  ('vencimientos',   '{admin}', '{admin}', 'S.dues'),
  ('fondos_mov',     '{admin}', '{admin}', 'S.fundTx y S.fundAdj'),
  ('facturas_anuladas','{admin}', '{admin}', ''),
  ('servicios',      '{admin,medico,residente,recepcion,almacen}', '{admin}', 'Lista de precios'),
  ('paquetes',       '{admin}', '{admin}', ''),
  -- Personal
  ('medicos',        '{admin,medico,residente,enfermeria_plus,enfermeria,almacen,recepcion,laboratorio,imagen}', '{admin}', 'S.doctors (datos profesionales)'),
  ('enfermeras',     '{admin,medico,residente,enfermeria_plus,enfermeria,almacen,recepcion}', '{admin}', 'S.nurseStaff'),
  ('notas_personal', '{admin}', '{admin}', 'Amonestaciones y destacados'),
  ('pacientes_eliminados','{admin}', '{admin}', '');

-- ---------------------------------------------------------------- Tablas de registros
-- Todas tienen la misma forma. pid (paciente) se extrae del registro para buscar rápido.
create or replace function public.crear_tabla_registros(t text) returns void language plpgsql as $$
begin
  execute format($f$
    create table public.%1$I (
      id text primary key,
      data jsonb not null,
      pid text generated always as (data->>'pid') stored,
      actualizado timestamptz not null default now(),
      actualizado_por uuid default auth.uid(),
      borrado boolean not null default false
    );
    create index on public.%1$I (pid);
    create index on public.%1$I (actualizado);
    alter table public.%1$I enable row level security;
    grant select, insert, update on public.%1$I to authenticated;
    create policy leer on public.%1$I for select to authenticated
      using (exists (select 1 from public.acceso a where a.tabla = %2$L and public.mi_rol() = any (a.leen)));
    create policy crear on public.%1$I for insert to authenticated
      with check (exists (select 1 from public.acceso a where a.tabla = %2$L and public.mi_rol() = any (a.escriben)));
    create policy cambiar on public.%1$I for update to authenticated
      using (exists (select 1 from public.acceso a where a.tabla = %2$L and public.mi_rol() = any (a.escriben)))
      with check (exists (select 1 from public.acceso a where a.tabla = %2$L and public.mi_rol() = any (a.escriben)));
    -- Nadie borra filas desde la aplicación: se marca borrado = true (queda el rastro)
  $f$, t, t);
end $$;

do $$ declare t text; begin
  for t in select tabla from public.acceso loop perform public.crear_tabla_registros(t); end loop;
end $$;

-- Quién y cuándo cambió cada fila (no se puede falsificar desde el navegador)
create or replace function public.sellar() returns trigger language plpgsql as $$
begin new.actualizado := now(); new.actualizado_por := auth.uid(); return new; end $$;
do $$ declare t text; begin
  for t in select tabla from public.acceso loop
    execute format('create trigger sellar before insert or update on public.%I for each row execute function public.sellar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- Configuración general (tasa, datos de la clínica, horarios…)
create table public.ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);
alter table public.ajustes enable row level security;
create policy ajustes_leer on public.ajustes for select to authenticated using (public.mi_rol() is not null);
create policy ajustes_admin on public.ajustes for all to authenticated using (public.es_admin()) with check (public.es_admin());
-- La tasa del día la puede actualizar cualquier usuario (se lee del BCV al entrar)
create policy ajustes_tasa on public.ajustes for update to authenticated
  using (clave in ('rate','rateDate','rateSource','rates','rateEUR','ratesEUR') and public.mi_rol() is not null)
  with check (clave in ('rate','rateDate','rateSource','rates','rateEUR','ratesEUR'));
-- Guardias y horarios: almacén asigna guardias
create policy ajustes_guardia on public.ajustes for update to authenticated
  using (clave in ('duty','nurseWeek') and public.mi_rol() in ('admin','almacen'))
  with check (clave in ('duty','nurseWeek'));
create trigger sellar before insert or update on public.ajustes for each row execute function public.sellar();

-- ---------------------------------------------------------------- Numeración (sin números repetidos entre equipos)
create table public.contadores (nombre text primary key, valor bigint not null);
alter table public.contadores enable row level security;
create policy contadores_leer on public.contadores for select to authenticated using (public.mi_rol() is not null);
create or replace function public.siguiente(n text) returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if public.mi_rol() is null then raise exception 'sin acceso'; end if;
  update public.contadores set valor = valor + 1 where nombre = n returning valor - 1 into v;
  if v is null then insert into public.contadores values (n, 2) on conflict (nombre) do update set valor = contadores.valor + 1 returning valor - 1 into v; end if;
  return v;
end $$;

-- ---------------------------------------------------------------- Historial de acciones (solo se agrega; nadie lo edita)
create table public.historial (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  usuario uuid default auth.uid(),
  nombre text,
  accion text not null,
  ref text
);
alter table public.historial enable row level security;
create policy historial_leer on public.historial for select to authenticated using (public.es_admin());
create policy historial_agregar on public.historial for insert to authenticated with check (public.mi_rol() is not null and usuario = auth.uid());

-- ---------------------------------------------------------------- Tiempo real: los demás equipos reciben los cambios al instante
do $$ declare t text; begin
  for t in select tabla from public.acceso loop execute format('alter publication supabase_realtime add table public.%I', t); end loop;
  execute 'alter publication supabase_realtime add table public.ajustes';
end $$;

-- ---------------------------------------------------------------- Archivos (privados; se abren con enlaces firmados de corta duración)
insert into storage.buckets (id, name, public) values ('historias', 'historias', false), ('archivos', 'archivos', false) on conflict do nothing;
create policy historias_leer on storage.objects for select to authenticated
  using (bucket_id = 'historias' and public.mi_rol() in ('admin','medico','residente'));
create policy historias_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'historias' and public.es_admin());
create policy archivos_leer on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.mi_rol() is not null);
create policy archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.mi_rol() is not null);

-- ---------------------------------------------------------------- Privilegios explícitos (las tablas nuevas no se exponen solas)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.perfiles to authenticated;
grant select on public.acceso to authenticated;
grant select, insert, update on public.ajustes to authenticated;
grant select on public.contadores to authenticated;
grant select, insert on public.historial to authenticated;
-- Las funciones internas no se pueden llamar desde fuera; mi_rol, es_admin y siguiente solo con sesión iniciada
drop function public.crear_tabla_registros(text);
revoke execute on all functions in schema public from public, anon;
grant execute on function public.mi_rol(), public.es_admin(), public.siguiente(text) to authenticated;
