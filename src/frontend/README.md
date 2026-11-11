# src/frontend — Cuna Inteligente IoT

Aplicación web mínima del Sprint 3. Muestra el nombre del proyecto y las tres
secciones previstas (Cuna, Colchón, Figuras LED) sin conectarse todavía a
ningún backend ni dispositivo real.

Esta fase **no** incluye:

- Conexión a Supabase (Auth, PostgreSQL, Realtime, Storage).
- Lecturas reales de sensores ni control de hardware.
- Autenticación de usuarios.

## Requisitos

- Node.js 24.x (probado con 24.22.2).
- npm 11.x (probado con 11.19.1).

## Instalación

Desde `src/frontend`:

```powershell
npm.cmd ci
```

## Comandos

```powershell
npm.cmd run dev     # Servidor de desarrollo (http://localhost:5173 por defecto)
npm.cmd run build   # Compilación de producción (tsc -b && vite build)
npm.cmd run lint    # Revisión estática con oxlint
npm.cmd run preview # Sirve el build de producción localmente
npm.cmd run test    # Pruebas automáticas (vitest run)
npm.cmd run test:watch # Pruebas en modo observación
```

## Pruebas

Vitest con entorno jsdom y Testing Library. Los tests viven en `tests/` y el
archivo `tests/setup.ts` registra los matchers de jest-dom. Los datos de
ejemplo solo se usan dentro de los tests. Para correr lint, build y test
juntos, usar el comando `/verificar` de Claude Code.

En una terminal que no sea PowerShell (por ejemplo, Git Bash) puede usarse
`npm` en lugar de `npm.cmd`.

## Variables de entorno

Copiar `.env.example` como `.env.local` y completar los valores cuando se
implemente la conexión con Supabase. La aplicación de esta fase arranca y
compila correctamente sin ningún valor configurado.

## Estado

Aplicación base ejecutable. Pendiente: integración con Supabase, firmware y
datos reales del dispositivo ([validación de la base](../../docs/Sprint3/validacion-base.md)).
