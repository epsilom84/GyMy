# CLAUDE.md — GyMy

Guía técnica completa para Claude Code. Léela entera antes de modificar cualquier archivo.

---

## Descripción

**GyMy** es una app web de registro de entrenamientos de gimnasio. Single-page app con backend Express + PostgreSQL desplegada en Railway.

- **URL producción**: https://gymy-production.up.railway.app/
- **Repo GitHub**: https://github.com/epsilom84/GyMy (privado, rama `main`)
- **Railway root dir**: `backend`

---

## Estructura del proyecto

```
gymy/
├── CLAUDE.md                  ← Este archivo
├── README.md                  ← Documentación general
├── .gitignore
├── subir_github.bat           ← Script Windows para push a GitHub
└── backend/                   ← TODO lo que Railway despliega (root dir: backend)
    ├── server.js              ← Entry point. Puerto: process.env.PORT || 3000
    ├── package.json           ← start: "node server.js"
    ├── .env.example           ← Variables de entorno de ejemplo
    ├── .gitignore
    ├── database/
    │   ├── init.js            ← Pool PostgreSQL + CREATE TABLE IF NOT EXISTS + seed 66 ejercicios
    │   └── migrate_ejercicios_catalogo.js ← Script standalone para crear/poblar catálogo
    ├── middleware/
    │   └── verifyToken.js     ← JWT middleware (req.user.id)
    ├── routes/
    │   ├── auth.routes.js     ← /api/auth/*
    │   └── gym.routes.js      ← /api/catalogo/* (PÚBLICO, antes de verifyToken) + /api/* (JWT)
    └── frontend/
        ├── index.html         ← SPA completa (~3130 líneas)
        ├── actividad.html     ← Vista workout activo
        ├── api.js             ← Cliente HTTP: apiCall(method, endpoint, body)
        └── assets/
            ├── musculos.svg
            ├── equipo/        ← SVGs de equipamiento
            ├── iconos_tipos_ejercicios/
            └── descarga.jpeg  ← Icono personalizado: Sentadilla Barra
```

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JS vanilla (sin frameworks) |
| Backend | Node.js + Express 4 |
| Base de datos | PostgreSQL (Railway managed) |
| Auth | JWT (access token 15m + refresh token) + bcrypt |
| Deploy | Railway (auto-deploy en push a `main`) |
| Gráficas | Chart.js 4 (CDN) |
| Rate limiting | express-rate-limit |
| Validación | express-validator |

---

## Variables de entorno necesarias

```env
DATABASE_URL=postgresql://...        # Railway lo pone automáticamente
JWT_SECRET=...                       # Clave para access tokens
JWT_REFRESH_SECRET=...               # Clave para refresh tokens
JWT_EXPIRES_IN=15m                   # Duración access token
NODE_ENV=production
PORT=3000                            # Railway lo sobreescribe
ANTHROPIC_API_KEY=sk-ant-...         # Para endpoint /api/ai/import
```

---

## Base de datos PostgreSQL

### Tablas

**`users`**
```sql
id SERIAL PK, username TEXT UNIQUE, email TEXT UNIQUE,
password TEXT (bcrypt), refresh_token TEXT, reset_token TEXT,
reset_token_exp TIMESTAMPTZ, created_at TIMESTAMPTZ, last_login TIMESTAMPTZ
```

**`sesiones`**
```sql
id SERIAL PK, user_id FK→users, fecha DATE, tipo TEXT,
duracion_min INT, notas TEXT, calorias INT,
valoracion INT (1-5), created_at TIMESTAMPTZ
INDEX: (user_id, fecha DESC)
```

**`ejercicios`**
```sql
id SERIAL PK, sesion_id FK→sesiones ON DELETE CASCADE,
nombre TEXT, series INT, reps INT, peso_kg REAL
INDEX: (sesion_id)
```

**`ejercicios_catalogo`**
```sql
id SERIAL PK, nombre TEXT, grupo_muscular TEXT, subgrupo TEXT,
equipo TEXT, tipo TEXT, descripcion TEXT, activo BOOLEAN, created_at TIMESTAMPTZ
```
Se borra y re-puebla automáticamente en `init.js` al arrancar el servidor desde `plantillas_ejercicios.json` (268 ejercicios).

### Helper functions (database/init.js)
- `queryOne(text, params)` → primera fila o null
- `queryAll(text, params)` → array de filas
- `withTransaction(fn)` → ejecuta fn(client) con BEGIN/COMMIT/ROLLBACK

---

## API — Endpoints

### Auth (`/api/auth/`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Registrar usuario |
| POST | `/login` | Login → access + refresh token |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Invalidar refresh token |
| GET | `/me` | Datos del usuario autenticado |
| POST | `/forgot-password` | Enviar email reset |
| POST | `/reset-password` | Cambiar contraseña con token |

Rate limit auth: 30 req / 15 min.

### Catálogo (`/api/catalogo/`) — ⚠️ PÚBLICOS, sin JWT

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/catalogo` | Todos los ejercicios agrupados por `grupo_muscular` |
| GET | `/catalogo/grupos` | Lista de grupos musculares disponibles |
| GET | `/catalogo/:id` | Detalle de un ejercicio |

> ⚠️ Estas rutas están declaradas **antes** de `router.use(verifyToken)` en `gym.routes.js`. No moverlas.

### Gym (`/api/`) — requieren JWT en `Authorization: Bearer <token>`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/sesiones` | Lista sesiones (filtros: tipo, fecha, limit, offset) |
| GET | `/sesiones/stats` | Estadísticas globales del usuario |
| GET | `/sesiones/:id` | Detalle de una sesión |
| POST | `/sesiones` | Crear sesión |
| PUT | `/sesiones/:id` | Actualizar sesión |
| DELETE | `/sesiones/:id` | Borrar sesión |
| POST | `/sesiones/sync` | Sync batch de sesiones offline |
| GET | `/sesiones/export/csv` | Exportar todo el historial como CSV |
| GET | `/ejercicios/historial` | Historial por ejercicio (stats + progresión) |
| POST | `/ai/import` | Importar sesiones con IA (Anthropic API) |

Rate limit general: 120 req / min.

---

## Frontend — index.html

Archivo único ~2300 líneas con toda la lógica. **No separes en archivos** a menos que se pida explícitamente.

### Funciones clave

```js
apiCall(method, endpoint, body)   // Cliente HTTP en api.js. endpoint es relativo a API_URL (/api)
                                   // ⚠️ NO usar para /api/catalogo → usar fetch('/api/catalogo') directo

loadCatalogo()                     // Carga catálogo desde /api/catalogo, cachea en _catalogoCache
wkGetDBAsync()                     // Devuelve catálogo (async, espera si no está cargado)
formatFecha(f)                     // Convierte DATE a "07 mar 2026"
showToast(msg, type)               // Notificación flotante
tipoIcon(t)                        // Emoji para tipo de sesión/grupo muscular
ejIconHtml(nombre, equipo, size)   // Icono del ejercicio: imagen personalizada si existe en EJ_ICONOS,
                                   // si no, SVG de equipo vía equipoSVGHtml()
equipoSVGHtml(equipo, size)        // SVG inline del equipamiento (barra, mancuerna, máquina…)
```

### Iconos personalizados por ejercicio (`EJ_ICONOS`)

```js
const EJ_ICONOS = {
  'sentadilla barra': '/assets/descarga.jpeg',
  // añadir más: 'nombre ejercicio en minúsculas': '/assets/imagen.ext'
};
```

Para añadir un icono a otro ejercicio:
1. Pon la imagen en `backend/frontend/assets/`
2. Añade la entrada en `EJ_ICONOS` (nombre en minúsculas, sin tildes no importa)
3. `ejIconHtml` lo usará automáticamente en el selector de workout, tarjeta activa y catálogo de perfil

### ⚠️ Trampas conocidas

- `apiCall` añade el prefijo `/api` automáticamente → llamar `/api/catalogo` resultaría en `/api/api/catalogo`
- Para endpoints públicos sin auth usar `fetch('/api/catalogo', ...)` directamente
- Los emojis y caracteres especiales (ñ, á, etc.) se corrompen si se hace `btoa()` desde el navegador sin `encodeURIComponent`
- Las fechas de la BD vienen como ISO completo (`2026-03-07T00:00:00.000Z`) → usar `formatFecha()` para mostrarlas

### Pantallas (vistas gestionadas con `data-screen`)
- `login` / `register` / `forgot` — Auth
- `dashboard` — Stats resumen + gráfica 8 semanas + últimas sesiones
- `workout` — Workout activo (timer descanso, PR detector, preload pesos, catálogo desde BD)
- `history` — Historial con búsqueda, filtros, export/import CSV
- `stats` — Progresión por ejercicio + distribución por días
- `profile` — Datos personales + catálogo BD + configuración + temas

### Grupos musculares (catálogo en BD, 268 ejercicios desde Excel)
```
Brazos Bíceps, Brazos Tríceps, Core, Espalda (Dorsal/Lumbar/Trapecio),
Hombros, Pecho, Piernas (Cuádriceps/Femoral/Gemelos/Glúteo)
```
El selector de grupos del workout se genera dinámicamente desde `_catalogoCache`.

### Temas disponibles
`dark` (defecto), `light`, `choni`, `material-dark`, `material-light`

---

## Flujo de despliegue

```
Modificar archivo local
       ↓
Commit y push a rama main en GitHub (GitHub Desktop o subir_github.bat)
       ↓
Railway detecta el push y redespliega automáticamente
       ↓
URL activa en ~60 segundos: https://gymy-production.up.railway.app/
```

### ⚠️ Subir archivos via GitHub API (cuando no hay red en bash)

El PAT expira ~14 mar 2026: `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`

```js
// Desde el navegador (en gymy-production.up.railway.app o github.com):
(async () => {
  const PAT = 'ghp_...';
  // 1. Obtener SHA actual del archivo
  const meta = await fetch('https://api.github.com/repos/epsilom84/GyMy/contents/backend/frontend/index.html',
    { headers: {'Authorization': `token ${PAT}`} }).then(r=>r.json());

  // 2. Descargar contenido, modificar, recodificar CORRECTAMENTE para UTF-8
  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(meta.content.replace(/\n/g,'')), c => c.charCodeAt(0))
  );
  const modified = decoded.replace('OLD', 'NEW');
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(modified)));

  // 3. Subir
  await fetch('https://api.github.com/repos/epsilom84/GyMy/contents/backend/frontend/index.html', {
    method: 'PUT',
    headers: {'Authorization': `token ${PAT}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({ message: 'fix: descripción', content: b64, sha: meta.sha })
  }).then(r=>r.json()).then(d => console.log(d.commit?.sha));
})();
```

---

## Convenciones de código

- **Sin TypeScript**, sin transpilación. JS vanilla en frontend, CommonJS en backend.
- **Sin ORM**. SQL directo con `queryOne` / `queryAll` / `withTransaction`.
- **Sin frameworks CSS**. CSS custom properties para temas (variables `--bg`, `--accent`, etc.).
- El frontend es una SPA de un solo archivo. Los cambios de pantalla son manipulación de DOM.
- Toda la lógica de autenticación usa `localStorage` para tokens en el cliente.
- Los iconos de ejercicio se sirven desde `/assets/` — imágenes estáticas en `backend/frontend/assets/`.

---

## Errores comunes a evitar

- ❌ No crear archivos separados para CSS o JS del frontend (todo va en `index.html`)
- ❌ No usar `sqlite3` — la app usa PostgreSQL
- ❌ No importar `DATABASE_PUBLIC_URL` — usar siempre `DATABASE_URL`
- ❌ No hacer `process.exit(1)` en middleware — solo en `initDB()` si falla la conexión
- ❌ No mover las rutas `/api/catalogo/*` después de `router.use(verifyToken)`
- ❌ No usar `btoa()` directamente con texto UTF-8 (rompe emojis y acentos)
- ❌ No usar `apiCall()` para `/api/catalogo` (dobla el prefijo `/api`)
- ✅ El server escucha en `0.0.0.0` (necesario para Railway)
- ✅ SSL condicional: interno Railway = false, externo = `{ rejectUnauthorized: false }`
- ✅ Usar `formatFecha()` para mostrar fechas de la BD al usuario
