# CLAUDE.md — GyMy

Guía técnica completa para Claude Code. Léela entera antes de modificar cualquier archivo.

---

## Descripción

**GyMy** es una app web de registro de entrenamientos de gimnasio. Single-page app con backend Express + PostgreSQL desplegada en Railway.

- **URL producción**: https://gymy-production.up.railway.app/
- **Repo GitHub**: https://github.com/epsilom84/GyMy (privado, rama `main`)
- **Railway root dir**: `backend` (Railway solo despliega el contenido de `/gymy/backend/`)

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
    ├── package.json           ← v3.0.0, start: "node server.js"
    ├── .env.example           ← Variables de entorno de ejemplo
    ├── .gitignore
    ├── database/
    │   ├── init.js            ← Pool PostgreSQL + CREATE TABLE IF NOT EXISTS + seed catálogo
    │   └── migrate_ejercicios_catalogo.js ← Script standalone para crear/poblar catálogo
    ├── middleware/
    │   └── verifyToken.js     ← JWT middleware (req.userId)
    ├── routes/
    │   ├── auth.routes.js     ← /api/auth/*
    │   └── gym.routes.js      ← /api/* + /api/catalogo/* (todas protegidas con verifyToken)
    └── frontend/
        ├── index.html         ← SPA completa (~2300 líneas, ~128KB)
        ├── actividad.html     ← Vista workout activo
        └── api.js             ← Cliente HTTP (fetch wrapper)
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

### Gym (`/api/`) — todas requieren JWT en `Authorization: Bearer <token>`

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

#### Catálogo de ejercicios (`/api/catalogo/`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/catalogo` | Todos los ejercicios agrupados por `grupo_muscular` |
| GET | `/catalogo/grupos` | Lista de grupos musculares disponibles |
| GET | `/catalogo/:id` | Detalle de un ejercicio |

Rate limit general: 120 req / min.

---

## Frontend — index.html

Archivo único ~2300 líneas con toda la lógica. **No separes en archivos** a menos que se pida explícitamente.

### Pantallas (vistas gestionadas con data-screen)
- `login` / `register` / `forgot` — Auth
- `dashboard` — Stats resumen + gráfica 8 semanas + últimas sesiones
- `workout` — Workout activo (timer de descanso, PR detector, preload pesos)
- `history` — Historial con búsqueda, filtros, export CSV, import CSV
- `stats` — Progresión por ejercicio + distribución por días
- `profile` — Datos personales + configuración + temas

### Grupos musculares y ejercicios (BASE_DB actualizada marzo 2026)
```
Hombros (8):  Press Hombros Mancuernas, Elevaciones Laterales Mancuernas,
              Elevaciones Laterales Máquina, Face Pull, Elevación Lateral Cable
              Unilateral, Press Hombros Barra, Press Hombros Máquina,
              Remo Máquina Unilateral

Espalda (7):  Jalón Agarre Cerrado Cable, Remo Cable Sentado,
              Remo Máquina Unilateral, Jalón Agarre Amplio Cable,
              Remo Barra Agarre Bajo, Remo Polea Unilateral, Pull Down Máquina

Piernas (9):  Extensión Piernas Máquina, Prensa Inclinada,
              Press Piernas Horizontal, Curl Femoral Máquina, Peso Muerto,
              Sentadilla Barra, Abducción Máquina, Aducción Máquina,
              Gemelos Máquina Sentado

Pecho (3):    Press Pecho Máquina Frontal, Press Pecho Máquina Inclinado,
              Aperturas Máquina

Brazos (5):   Press Tríceps Cuerda Cable, Curl Bíceps Mancuernas Alterno,
              Curl Bíceps Máquina Scott, Curl Bíceps Martillo Alterno,
              Curl Bíceps Mancuerna

Cardio (3):   Cinta, Bicicleta, Elíptica
```

### Temas disponibles
`dark` (defecto), `light`, `choni`, `material-dark`, `material-light`

### Features clave del frontend
- **Offline sync**: sesiones en localStorage, badge naranja con pendientes, sync manual y automático
- **Preload pesos**: carga automática del último peso usado o máximo volumen
- **PR detector**: detecta récords en tiempo real durante el workout
- **Timer descanso**: se activa automáticamente al marcar serie como hecha
- **Importar CSV**: agrupa por fecha, cada fecha = 1 sesión
- **Tab Workout persistente**: visible en navbar hasta guardar/descartar
- **Repetir Workout**: desde historial, precarga ejercicios y pesos previos

---

## Flujo de despliegue

```
Modificar archivo local
       ↓
Commit y push a rama main en GitHub
       ↓
Railway detecta el push y redespliega automáticamente
       ↓
URL activa en ~60 segundos: https://gymy-production.up.railway.app/
```

### Subir cambios a GitHub (vía API cuando bash no tiene red)
```js
// 1. GET /repos/epsilom84/GyMy/contents/gymy/backend/frontend/index.html
//    → guardar el SHA del archivo
// 2. Codificar contenido en base64
// 3. PUT /repos/epsilom84/GyMy/contents/... con { message, content (base64), sha }
// PAT: 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 (expira ~14 mar 2026)
```

---

## Convenciones de código

- **Sin TypeScript**, sin transpilación. JS vanilla en frontend, CommonJS en backend.
- **Sin ORM**. SQL directo con `queryOne` / `queryAll` / `withTransaction`.
- **Sin frameworks CSS**. CSS custom properties para temas (variables `--color-*`).
- El frontend es una SPA de un solo archivo. Los cambios de pantalla son manipulación de DOM, no routing real.
- Toda la lógica de autenticación usa `localStorage` para tokens en el cliente.

---

## Errores comunes a evitar

- ❌ No crear archivos separados para CSS o JS del frontend (todo va en `index.html`)
- ❌ No usar `sqlite3` — la app migró a PostgreSQL en v3
- ❌ No importar `DATABASE_PUBLIC_URL` — usar siempre `DATABASE_URL`
- ❌ No hacer `process.exit(1)` en middleware — solo en `initDB()` si falla la conexión
- ✅ El server escucha en `0.0.0.0` (necesario para Railway)
- ✅ SSL condicional: interno Railway = false, externo = `{ rejectUnauthorized: false }`
