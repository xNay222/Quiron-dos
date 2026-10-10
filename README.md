# Quirón Dos · rediseño

Copia del programa Quirón (versión 1, repositorio `quiron`, que no se modifica) para aplicar el diseño nuevo
"Espacios" aprobado por el dueño el 10 de octubre de 2026. La maqueta aprobada está en `diseno/maqueta-concepto-b.html`.

- Se abre con `serve.ps1` en **http://localhost:8082** (la versión 1 usa el 8080): los datos del navegador quedan separados.
- Para probar con los datos reales: Ajustes › Copias de seguridad › Restaurar, con una copia descargada de la versión 1.
- Toda la funcionalidad, roles, permisos y circuitos de la versión 1 se mantienen; solo cambia el diseño.
# Quirón · Sistema de gestión clínica

Software de gestión de Quirón Especialidades Médicas (RIF J-50213973): agenda, quirófano, hospitalización,
pacientes e historias, exámenes, presupuestos, contabilidad, inventario, usuarios y tutoriales por rol.

## Estructura

- `quiron/` — la aplicación (HTML + JavaScript, sin compilación). Se abre con `quiron/index.html`.
  - `data*.js` — datos y reglas de negocio · `views-*.js` — pantallas · `pdf-kit.js` — documentos PDF A4 · `app.js` — navegación, roles y permisos.

## Estado actual (versión de prueba)

- Los datos se guardan **en el navegador** de cada computadora (no en la nube). Use una sola computadora para cargar
  información y descargue la copia diaria en **Ajustes › Copias de seguridad**: esa copia se importará a la versión en la nube.
- **Ajustes › Datos de trabajo › Empezar en limpio** quita los datos de ejemplo y conserva usuarios, servicios y paquetes.
- La lectura con IA (fotos de cajas, historias en papel, Quirón IA) funciona solo dentro de claude.ai; fuera de ahí requiere la API (fase nube).

## Publicar en Vercel (prueba)

1. En Vercel: **Add New › Project** › importar este repositorio.
2. **Root Directory:** `quiron` · **Framework Preset:** Other · sin comando de compilación.
3. **Deploy**. La primera persona que abre la dirección crea la cuenta de administrador.

## Próxima fase

Base de datos en la nube (Supabase, región São Paulo), usuarios y permisos validados en el servidor, almacenamiento de
archivos (consentimientos, historias digitalizadas, rayos X en DICOM) con copia en un segundo proveedor, e IA por API.

