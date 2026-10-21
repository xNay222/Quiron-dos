-- 1) Rol "Médico anestesiólogo": lee y escribe lo mismo que un médico
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('admin','medico','anestesiologo','residente','enfermeria_plus','enfermeria','almacen','recepcion','laboratorio','imagen'));
update public.acceso set leen = array_append(leen, 'anestesiologo') where 'medico' = any(leen) and not 'anestesiologo' = any(leen);
update public.acceso set escriben = array_append(escriben, 'anestesiologo') where 'medico' = any(escriben) and not 'anestesiologo' = any(escriben);

-- 2) Residentes: historia clínica, consultas, exámenes y evoluciones solo de pacientes activos
--    (ingresados en hospitalización o emergencia, con cirugía hoy o en la sala de espera) y lo que ellos mismos hicieron.
create or replace function public.mi_doc() returns text language sql stable security definer set search_path = public as $$
  select doc from public.perfiles where id = auth.uid() and estado = 'activo'
$$;
create or replace function public.paciente_activo(p text) returns boolean language sql stable security definer set search_path = public as $$
  select p is not null and (
       exists (select 1 from public.ingresos where pid = p and not borrado and data->>'status' = 'ingresado')
    or exists (select 1 from public.citas where pid = p and not borrado and data->>'kind' = 'cirugia'
                 and data->>'date' = to_char((now() at time zone 'America/Caracas')::date, 'YYYY-MM-DD')
                 and coalesce(data->>'status', '') not in ('cancelada', 'no_asistio'))
    or exists (select 1 from public.triaje where pid = p and not borrado and data->>'status' = 'espera'))
$$;
revoke execute on function public.mi_doc(), public.paciente_activo(text) from public, anon;
grant execute on function public.mi_doc(), public.paciente_activo(text) to authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['historias', 'notas_clinicas', 'consultas', 'examenes', 'evoluciones'] loop
    execute format('drop policy if exists leer on public.%I', t);
    execute format($f$create policy leer on public.%1$I for select to authenticated using (
      exists (select 1 from public.acceso a where a.tabla = %1$L and public.mi_rol() = any (a.leen))
      and (public.mi_rol() <> 'residente' or public.paciente_activo(pid) or data->>'doc' = public.mi_doc()))$f$, t);
  end loop;
end $$;

-- Historias escaneadas (PDF): médicos, anestesiólogos y administración; los residentes no tienen el archivo
drop policy if exists historias_leer on storage.objects;
create policy historias_leer on storage.objects for select to authenticated
  using (bucket_id = 'historias' and public.mi_rol() in ('admin', 'medico', 'anestesiologo'));
