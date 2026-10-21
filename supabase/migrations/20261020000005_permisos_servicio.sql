-- Las funciones del servidor (usuarios, ia) usan la cuenta interna service_role. Como las tablas nuevas no se exponen
-- solas, hay que darle permiso explícito. Solo a service_role: nunca a anon ni a los usuarios.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
