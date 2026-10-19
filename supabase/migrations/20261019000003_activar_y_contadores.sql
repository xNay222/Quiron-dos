-- Al aceptar la invitación y crear su contraseña, la persona activa su propio perfil (solo si estaba invitada)
create or replace function public.activarme() returns void language sql security definer set search_path = public as $$
  update public.perfiles set estado = 'activo' where id = auth.uid() and estado = 'invitado'
$$;
-- Mi perfil aunque todavía esté invitado (para saber si debe crear su contraseña)
create or replace function public.mi_perfil() returns public.perfiles language sql stable security definer set search_path = public as $$
  select * from public.perfiles where id = auth.uid()
$$;
-- La aplicación numera con S.exSeq, S.invSeq…; al guardar se sube el contador del servidor (nunca baja)
create or replace function public.subir_contador(n text, v bigint) returns bigint language plpgsql security definer set search_path = public as $$
declare r bigint;
begin
  if public.mi_rol() is null then raise exception 'sin acceso'; end if;
  insert into public.contadores values (n, v) on conflict (nombre) do update set valor = greatest(contadores.valor, excluded.valor) returning valor into r;
  return r;
end $$;
revoke execute on function public.activarme(), public.mi_perfil(), public.subir_contador(text, bigint) from public, anon;
grant execute on function public.activarme(), public.mi_perfil(), public.subir_contador(text, bigint) to authenticated;
