-- Registro de errores de la aplicación (para diagnosticar fallos en equipos que no podemos ver, como un iPhone).
-- Guarda el mensaje técnico, la pantalla y el modelo del navegador; nunca datos de pacientes. Solo Administración lo lee.
create table if not exists public.errores (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  usuario uuid default auth.uid(),
  mensaje text not null,
  donde text,
  ruta text,
  navegador text
);
alter table public.errores enable row level security;
create policy errores_agregar on public.errores for insert to authenticated with check (usuario = auth.uid() and length(mensaje) < 2000);
create policy errores_leer on public.errores for select to authenticated using (public.es_admin());
grant select, insert on public.errores to authenticated;
grant all on public.errores to service_role;
