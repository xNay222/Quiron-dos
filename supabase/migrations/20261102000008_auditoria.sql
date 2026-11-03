-- Arreglos de la auditoría del 02/11 (permisos de la nube que no coincidían con lo que hace cada rol en la aplicación)

-- 1) Enfermería registra pacientes nuevos al hacer el triaje (y anota alergias): ahora también puede guardar la ficha
update public.acceso set escriben = escriben || array['enfermeria_plus', 'enfermeria']
  where tabla = 'pacientes' and not 'enfermeria' = any(escriben);

-- 2) Ajustes que cada rol puede guardar además de Administración:
--    Laboratorio, su catálogo y valores de referencia; los médicos, la marca de "plantillas iniciales ya creadas"
create table if not exists public.ajustes_por_rol (clave text not null, rol text not null, primary key (clave, rol));
alter table public.ajustes_por_rol enable row level security;
create policy ajustes_por_rol_leer on public.ajustes_por_rol for select to authenticated using (true);
grant select on public.ajustes_por_rol to authenticated;
grant all on public.ajustes_por_rol to service_role;
insert into public.ajustes_por_rol values
  ('labCatalog', 'laboratorio'), ('labCatalogMeta', 'laboratorio'),
  ('tplSeeded', 'medico'), ('tplSeeded', 'residente'), ('tplSeeded', 'anestesiologo')
on conflict do nothing;
create policy ajustes_rol_crear on public.ajustes for insert to authenticated
  with check (exists (select 1 from public.ajustes_por_rol x where x.clave = ajustes.clave and x.rol = public.mi_rol()));
create policy ajustes_rol_cambiar on public.ajustes for update to authenticated
  using (exists (select 1 from public.ajustes_por_rol x where x.clave = ajustes.clave and x.rol = public.mi_rol()))
  with check (exists (select 1 from public.ajustes_por_rol x where x.clave = ajustes.clave and x.rol = public.mi_rol()));

-- 3) Recepción ve el estado de las consultas sin su contenido clínico
create or replace function public.consultas_resumen() returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'pid', pid, 'doc', data->'doc', 'date', data->'date', 'time', data->'time', 'status', data->'status',
                            'specialty', data->'specialty', 'type', data->'type', 'apptId', data->'apptId')
  from public.consultas where not borrado and public.mi_rol() is not null
$$;
revoke execute on function public.consultas_resumen() from public, anon;
grant execute on function public.consultas_resumen() to authenticated, service_role;

-- 4) Quien escribe en una tabla que no lee (p. ej. Recepción crea una cuenta) puede ver la fila que guardó él mismo.
--    Sin esto, el segundo guardado de esa fila falla (actualizar exige poder verla).
do $$ declare t text; begin
  for t in select tabla from public.acceso loop
    execute format('drop policy if exists leer_propio on public.%I', t);
    execute format('create policy leer_propio on public.%I for select to authenticated using (actualizado_por = auth.uid() and public.mi_rol() is not null)', t);
  end loop;
end $$;

-- 5) La numeración llega a todos los equipos al momento
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contadores') then
    execute 'alter publication supabase_realtime add table public.contadores';
  end if;
end $$;
