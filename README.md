# Damián | Gestión de cartera (Frontend)

Aplicación de gestión de clientes, préstamos, cuotas, pagos y cartera. Construida con
**Next.js 16 (App Router)**, **React 19** y **Tailwind 4**, conectada a un backend
**PocketBase** mediante el SDK oficial.

## Requisitos

- Node 24 + pnpm
- Backend PocketBase en ejecución (ver `../damian-backend`)

## Configuración

Crea `.env.local` (o usa variables de entorno en el build de producción):

```bash
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

> `NEXT_PUBLIC_*` se incrusta en tiempo de **build**; define la URL definitiva antes de
> `pnpm build` en producción.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Abre http://localhost:3000 e ingresa con un operador de PocketBase. El backend de
ejemplo crea por defecto:

- Usuario: `admin@damian.local`
- Contraseña: `Damian2026*`

> Cambia esa contraseña antes de producción (panel PocketBase → colección `operators`).

## Producción

```bash
pnpm build
pnpm start
```

Otros scripts:

```bash
pnpm typecheck   # tsc --noEmit
```

## Autenticación

El acceso usa la colección `operators` de PocketBase con email/contraseña. Todas las
colecciones de datos requieren un usuario autenticado. Si el token expira, la app
redirige a `/login`.

## Estructura

```
app/
  layout.tsx              # Providers (auth, datos, toasts)
  login/page.tsx          # Inicio de sesión
  (app)/                  # Área autenticada (AppShell + guard)
    page.tsx              # Dashboard
    buscador/ clientes/ prestamos/ cuotas/ pagos/ cartera/ reportes/ configuracion/
    clientes/[id]/ prestamos/[id]/
components/
  app-shell.tsx           # Sidebar, header y buscador global
  providers.tsx           # Auth + carga de datos + notificaciones
  login-form.tsx
  ui/kit.tsx              # Componentes base (Badge, Stat, Modal, tabla…)
  modals/                 # Cliente, préstamo, pago
  views/                  # Vistas por módulo
lib/
  pocketbase.ts           # Cliente PocketBase
  types.ts                # Tipos de las colecciones
  format.ts               # Moneda, fechas, CSV…
  derive.ts               # Estados y cálculos derivados
```

## Funcionalidad

- **Dashboard**: cartera activa, por cobrar, vencido, recaudo, próximas cuotas y actividad.
- **Buscador**: búsqueda de clientes por nombre, documento, teléfono o ciudad.
- **Clientes**: alta/edición, filtros, exportación CSV y detalle con historial.
- **Préstamos**: alta guiada (cliente → condiciones → resumen → calendario) y detalle.
- **Cuotas**: agenda por hoy, mañana, vencidas y próximas; registro de pagos.
- **Pagos**: historial, totales y exportación (eliminación solo para `admin`).
- **Cartera / Reportes**: indicadores de saldos y recaudo.
- **Configuración**: datos del negocio y preferencias (solo `admin`).

Los saldos, estados y el estado de cada cuota se recalculan en el backend al registrar
un pago (migraciones y hooks en `../damian-backend`).
