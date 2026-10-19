-- Datos profesionales (cédula, n.º de colegiado, colegio, MPPS): una vez que el médico los confirma (datos.credsLock),
-- solo Administración puede cambiarlos. La regla vive en la base de datos: no se puede saltar desde el navegador.
create or replace function public.proteger_datos_profesionales() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_admin() then return new; end if;
  if old.datos ? 'credsLock' and (
       new.datos->>'ci' is distinct from old.datos->>'ci' or new.datos->>'cm' is distinct from old.datos->>'cm'
    or new.datos->>'colegio' is distinct from old.datos->>'colegio' or new.datos->>'mpps' is distinct from old.datos->>'mpps'
    or new.datos->'credsLock' is distinct from old.datos->'credsLock') then
    raise exception 'Sus datos profesionales ya están registrados. Solo Administración puede corregirlos.';
  end if;
  return new;
end $$;
drop trigger if exists proteger_datos_profesionales on public.perfiles;
create trigger proteger_datos_profesionales before update on public.perfiles for each row execute function public.proteger_datos_profesionales();
revoke execute on function public.proteger_datos_profesionales() from public, anon, authenticated;
