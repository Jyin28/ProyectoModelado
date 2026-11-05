# Sprint 3 — Entorno e instalación (Windows)

## Requisitos

- Node.js 24.x (verificado con 24.22.2).
- npm 11.x (verificado con 11.19.1).
- PowerShell (usar `npm.cmd` en lugar de `npm` cuando sea necesario).

## Pasos

Desde la raíz del repositorio:

```powershell
cd src\frontend
npm.cmd install
npm.cmd run dev
```

Abrir la URL que imprime Vite (por defecto `http://localhost:5173/`).

## Otros comandos (desde `src/frontend`)

```powershell
npm.cmd run build    # Compilación de producción
npm.cmd run lint      # Revisión estática (oxlint)
npm.cmd run preview   # Sirve el build de producción
```

## Variables de entorno

No se requieren para esta fase. Si se desea preparar el archivo para fases
futuras:

```powershell
copy .env.example .env.local
```

y completar los valores cuando exista integración real con Supabase.
