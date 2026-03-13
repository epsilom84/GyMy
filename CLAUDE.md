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

### Estado actual (en migración)

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
    ├── excel_to_json.js       ← Convierte plantilla_ejercicios.xlsx → plantillas_ejercicios.json
    ├── check_dupes.js         ← Detecta duplicados en el Excel
    ├── database/
    │   ├── init.js            ← Pool PostgreSQL + CREATE TABLE IF NOT EXISTS + upsert seeds
    │   └── migrate_ejercicios_catalogo.js ← Script standalone para crear/poblar catálogo
    ├── middleware/
    │   └── verifyToken.js     ← JWT middleware (req.user.id)
    ├── routes/
    │   ├── auth.routes.js     ← /api/auth/*
    │   └── gym.routes.js      ← /api/catalogo/* (PÚBLICO, antes de verifyToken) + /api/* (JWT)
    └── frontend/
        ├── index.html         ← HTML estructural + carga de scripts/CSS
        ├── api.js             ← Cliente HTTP: apiCall(method, endpoint, body)
        ├── import.js          ← Lógica de importación de historial
        ├── sw.js              ← Service Worker (PWA)
        ├── manifest.json      ← Web App Manifest (PWA)
        ├── css/               ← Estilos separados por responsabilidad
        │   ├── base.css       ← Reset, variables CSS, tipografía, temas
        │   ├── components.css ← Botones, cards, modales, chips, toasts, skeletons
        │   └── layout.css     ← Navbar, pages, FABs, grid
        ├── js/                ← Módulos JS por pantalla/dominio
        │   ├── app.js         ← Init, navegación (goTab), globals, helpers (formatFecha, showToast…)
        │   ├── auth.js        ← Login, register, logout, refresh token
        │   ├── store.js       ← Estado global, cachés (_catalogoCache, _plantillasCache, _uk)
        │   ├── dashboard.js   ← Dashboard, stats resumen, sesiones recientes
        │   ├── workout.js     ← Workout activo, timer, series, PR detector
        │   ├── historial.js   ← Historial, filtros, swipe-to-delete, export
        │   ├── stats.js       ← Progresión por ejercicio, gráficas
        │   ├── perfil.js      ← Perfil usuario, catálogo BD, plantillas personales, temas
        │   └── coach.js       ← Coach Sasha, caché del plan, proxy IA
        └── assets/
            ├── icon.svg                    ← Icono PWA (mancuerna SVG)
            ├── musculos.svg               ← Ilustración cuerpo humano (empty states)
            ├── plantillas_ejercicios.json ← 262 ejercicios (fuente del catálogo)
            ├── plantilla_ejercicios.xlsx  ← Excel fuente del catálogo
            ├── equipo/                    ← SVGs de equipamiento
            └── descarga.jpeg             ← Icono personalizado: Sentadilla Barra
```

### Objetivo de arquitectura escalable

El frontend está migrando de un único `index.html` monolítico (~3500 líneas) a una estructura modular. **Cada nueva funcionalidad se crea en el archivo correspondiente**, nunca añadiéndola al montón en `index.html`. La migración es incremental: no hay que reescribir todo de golpe, pero todo código nuevo sigue la estructura modular.

**Principios:**
- Un archivo por responsabilidad — una pantalla o dominio por módulo JS
- El CSS se separa del JS y del HTML
- `index.html` solo contiene la estructura HTML y las etiquetas `<link>`/`<script>`
- Los módulos se cargan en orden explícito al final del `<body>` (sin bundler, sin imports ES modules obligatorios)
- Las funciones que usen módulos del mismo fichero no necesitan `export`; las compartidas entre módulos se exponen en `window` o en un objeto global `App`

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
| IA | @anthropic-ai/sdk (Claude Haiku) |
| Rate limiting | express-rate-limit |
| Validación | express-validator |
| PWA | Web App Manifest + Service Worker |

---

## Variables de entorno necesarias

```env
DATABASE_URL=postgresql://...        # Railway lo pone automáticamente
JWT_SECRET=...                       # Clave para access tokens
JWT_REFRESH_SECRET=...               # Clave para refresh tokens
JWT_EXPIRES_IN=15m                   # Duración access token
NODE_ENV=production
PORT=3000                            # Railway lo sobreescribe
ANTHROPIC_API_KEY=sk-ant-...         # Para Coach Sasha y /api/ai/import
```

---

## Base de datos PostgreSQL

### Tablas

**`users`**
```sql
id SERIAL PK, username TEXT UNIQUE, email TEXT UNIQUE,
password TEXT (bcrypt), refresh_token TEXT, reset_token TEXT,
reset_token_exp TIMESTAMPTZ, created_at TIMESTAMPTZ, last_login TIMESTAMPTZ,
edad INT, genero TEXT, peso_corporal REAL
```

**`sesiones`**
```sql
id SERIAL PK, user_id FK→users, fecha DATE, tipo TEXT,
duracion_min INT, notas TEXT, calorias INT,
valoracion INT (1-5), importado BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ
INDEX: (user_id, fecha DESC)
```

**`ejercicios`**
```sql
id SERIAL PK, sesion_id FK→sesiones ON DELETE CASCADE,
nombre TEXT, series INT, reps INT, peso_kg REAL, sets_data TEXT
INDEX: (sesion_id)
```

**`ejercicios_catalogo`**
```sql
id SERIAL PK, nombre TEXT UNIQUE, grupo_muscular TEXT, subgrupo TEXT,
equipo TEXT, tipo TEXT, descripcion TEXT, activo BOOLEAN, created_at TIMESTAMPTZ
```
Se actualiza con **upsert** en `init.js` al arrancar el servidor desde `plantillas_ejercicios.json`. No se borra nada — los ejercicios añadidos vía API se preservan.

**`plantillas_ejercicios`**
```sql
id SERIAL PK, nombre TEXT, grupo_muscular TEXT, subgrupo TEXT,
equipo TEXT, tipo TEXT DEFAULT 'fuerza',
user_id INTEGER FK→users ON DELETE CASCADE,  -- NULL = genérica, valor = personal
activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ
INDEX: (user_id), (grupo_muscular)
```

### Helper functions (database/init.js)
- `pool` → instancia del pool de conexiones (exportada)
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
| POST | `/catalogo` | Crear ejercicio en catálogo (usado por importación) |

> ⚠️ Estas rutas están declaradas **antes** de `router.use(verifyToken)` en `gym.routes.js`. No moverlas.

### Gym (`/api/`) — requieren JWT en `Authorization: Bearer <token>`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/sesiones` | Lista sesiones (filtros: `tipo`, `desde`, `hasta`, `q`, `grupo`, `subgrupo`, `page`, `limit`) |
| GET | `/sesiones/stats` | Estadísticas globales del usuario |
| GET | `/sesiones/:id` | Detalle de una sesión |
| POST | `/sesiones` | Crear sesión |
| PUT | `/sesiones/:id` | Actualizar sesión |
| DELETE | `/sesiones` | Borrar **todo** el historial del usuario |
| DELETE | `/sesiones/:id` | Borrar sesión individual |
| POST | `/sesiones/sync` | Sync batch de sesiones offline |
| GET | `/sesiones/export/csv` | Exportar todo el historial como CSV |
| GET | `/ejercicios/historial` | Historial por ejercicio (stats + progresión) |
| POST | `/ai/import` | Proxy hacia Anthropic API (Coach Sasha plan) |
| GET | `/plantillas` | Plantillas genéricas + personales del usuario |
| POST | `/plantillas` | Crear plantilla personal |
| POST | `/plantillas/bulk` | Crear varias plantillas personales de una vez |
| DELETE | `/plantillas/:id` | Eliminar plantilla personal (solo propia) |
| DELETE | `/plantillas` | Eliminar **todas** las plantillas personales del usuario |

Rate limit general: 120 req / min.

#### Filtros en `GET /api/sesiones`

| Parámetro | Descripción |
|---|---|
| `q` | Texto libre: busca en tipo, notas, fecha (3 formatos) y nombres de ejercicios (subquery EXISTS) |
| `tipo` | Tipo de sesión exacto (Fuerza, Cardio, HIIT…) |
| `grupo` | Grupo muscular — filtra sesiones que contengan ejercicios de ese grupo (JOIN con `ejercicios_catalogo`) |
| `subgrupo` | Subgrupo muscular — mismo mecanismo que `grupo` |
| `desde` / `hasta` | Rango de fechas (DATE) |
| `page` / `limit` | Paginación |

---

## Frontend — arquitectura modular

El frontend es una SPA sin framework, organizada en módulos JS y CSS independientes:

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Solo HTML estructural + `<link>` CSS + `<script>` en orden al final del `<body>` |
| `api.js` | Cliente HTTP (`apiCall`) y gestión de tokens |
| `js/store.js` | Estado global compartido: cachés, `_uk()`, `invalidatePlantillas()` |
| `js/app.js` | Inicialización, `goTab()`, helpers de UI (`showToast`, `formatFecha`, `haptic`) |
| `js/auth.js` | Login, register, logout, `_clearUserCaches()` |
| `js/dashboard.js` | Pantalla dashboard, stats resumen, `renderRecientes()` |
| `js/workout.js` | Workout activo completo: timer, series, PR detector, preload |
| `js/historial.js` | Historial, filtros, swipe-to-delete, exportar CSV |
| `js/stats.js` | Progresión por ejercicio, gráficas Chart.js |
| `js/perfil.js` | Perfil usuario, catálogo BD, plantillas personales, temas |
| `js/coach.js` | Coach Sasha: caché del plan, llamada a IA |
| `import.js` | Importación de historial CSV/Excel/IA (mantiene su nombre actual) |
| `css/base.css` | Variables CSS (`--bg`, `--accent`…), reset, tipografía, temas dark/light |
| `css/components.css` | Botones, cards, modales, chips, toasts, skeletons, swipe |
| `css/layout.css` | Navbar, páginas `.page`, FABs, grid de ejercicios |

**Cómo añadir funcionalidad nueva:**
1. Si pertenece a una pantalla existente → editar el módulo JS correspondiente
2. Si es una pantalla nueva → crear `js/nueva-pantalla.js` y añadir `<script src="/js/nueva-pantalla.js">` en `index.html`
3. CSS nuevo → añadir al archivo CSS más apropiado (nunca inline en JS salvo casos puntuales)
4. Nunca volver a añadir lógica de negocio directamente en `index.html`

### Funciones clave

```js
apiCall(method, endpoint, body)   // Cliente HTTP en api.js. endpoint relativo a /api
                                   // ⚠️ NO usar para /api/catalogo → fetch('/api/catalogo') directo

loadCatalogo()                     // Carga catálogo desde /api/catalogo, cachea en _catalogoCache
loadPlantillas()                   // Carga plantillas desde /api/plantillas, cachea en _plantillasCache
invalidatePlantillas()             // Invalida _plantillasCache para forzar recarga
wkGetDB()                          // Fusiona _catalogoCache + _plantillasCache + localStorage
wkGetDBAsync()                     // Igual que wkGetDB() pero espera a que cachés estén listas
formatFecha(f)                     // Convierte DATE a "07 mar 2026"
showToast(msg, type)               // Notificación flotante
haptic(ms)                         // Vibración nativa (navigator.vibrate); falla silenciosamente si no soportado
tipoIcon(t)                        // Emoji para tipo de sesión/grupo muscular
ejIconHtml(nombre, equipo, size)   // Icono del ejercicio: imagen custom (EJ_ICONOS) o SVG de equipo
equipoSVGHtml(equipo, size)        // SVG inline del equipamiento
autoThemeByHour()                  // Aplica dark/light según hora si no hay preferencia guardada
_initSwipeDelete()                 // Activa swipe-to-delete en .swipe-wrap del historial
_rtUpdateRing(secs, total)         // Actualiza el SVG progress ring del timer de descanso
```

### Iconos personalizados por ejercicio (`EJ_ICONOS`)

```js
const EJ_ICONOS = {
  'sentadilla barra': '/assets/descarga.jpeg',
  // añadir más: 'nombre ejercicio en minúsculas': '/assets/imagen.ext'
};
```

Para añadir un icono:
1. Pon la imagen en `backend/frontend/assets/`
2. Añade la entrada en `EJ_ICONOS` (nombre en minúsculas)
3. `ejIconHtml` lo usará automáticamente en selector workout, tarjeta activa y catálogo perfil

### ⚠️ Trampas conocidas

- `apiCall` añade el prefijo `/api` → llamar `/api/catalogo` resultaría en `/api/api/catalogo`
- Para endpoints públicos sin auth usar `fetch('/api/catalogo', ...)` directamente
- Los emojis y caracteres especiales (ñ, á, etc.) se corrompen si se hace `btoa()` sin `encodeURIComponent`
- Las fechas de la BD vienen como ISO completo (`2026-03-07T00:00:00.000Z`) → usar `formatFecha()`
- `wkGetDB()` es síncrono; usar `wkGetDBAsync()` si hay riesgo de que las cachés no estén listas
- `haptic()` llama a `navigator.vibrate` — no funciona en iOS Safari (silencioso)

### Caché del catálogo y plantillas

```js
_catalogoCache     // null | {grupo: [{em, n, m, sg, id, equipo}]}  — de /api/catalogo
                   //   n = nombre, m = subgrupo uppercase, sg = subgrupo original (para filtros BD)
_plantillasCache   // null | [{id, nombre, grupo_muscular, ..., propia}]
_catalogoLoading   // Promise en vuelo o null
_plantillasLoading // Promise en vuelo o null
```

`wkGetDB()` fusiona: catálogo base → plantillas BD → localStorage (compat).

### Pantallas (gestionadas con `.page` / `.page.active`)

- `login` / `register` / `forgot` — Auth
- `dashboard` — Stats + gráfica 8 semanas + Coach Sasha + sesiones recientes
- `workout` — Workout activo: timer con ring SVG, dots de series, preload, PR detector, catálogo BD
- `historial` — Buscador tiempo real, filtros tipo + grupo/subgrupo, swipe-to-delete, export/import
- `stats` — Progresión por ejercicio + distribución días
- `perfil` — Datos personales + catálogo BD + plantillas personales + temas + configuración

### Navegación

```js
function goTab(name, btn)
```

- Usa `_TAB_ORDER` (array) para determinar dirección de transición (slide derecha/izquierda)
- Añade clase `.slide-right` o `.slide-left` a `.page.active` y la elimina en 220ms
- Carga datos al activar cada pantalla (`loadHistorial`, `initStatsView`, etc.)

### Grupos musculares (catálogo en BD, 262 ejercicios desde Excel)

```
Brazos Bíceps, Brazos Tríceps, Core, Espalda (Dorsal/Lumbar/Trapecio),
Hombros, Pecho, Piernas (Cuádriceps/Femoral/Gemelos/Glúteo)
```

### Filtros grupo/subgrupo en historial

El historial tiene tres filas de chips:
1. `#tipo-filters` — Todos | Fuerza | Cardio | HIIT
2. `#grupo-filters` — dinámico desde `_catalogoCache`, se popula en `populateGrupoFilters()`
3. `#subgrupo-filters` — dinámico según el grupo seleccionado, via `_renderSubgrupoFilters()`

Variables de estado: `currentGrupoFilter`, `currentSubgrupoFilter` (ambas `''` por defecto).

### Workout — funciones clave

```js
wkCardHTML(ex)         // Genera HTML completo de una tarjeta de ejercicio (dots, sets, steppers)
wkToggleDone(exId,si)  // Marca/desmarca serie; dispara haptic + bounce + rest timer
wkStartRestTimer()     // Inicia countdown + anima progress ring SVG vía _rtUpdateRing()
wkAddSet(exId)         // Añade serie; dispara haptic corto
```

Los steppers (kg/reps) usan `Bebas Neue` 22px para máxima legibilidad en el gimnasio.

### PWA

```
manifest.json   — name, short_name, start_url, display:standalone, theme_color, icons
sw.js           — install: precachea SHELL; activate: limpia cachés antiguas; fetch: cache-first assets, network-first HTML, bypass /api/
index.html      — <link rel="manifest">, meta tags iOS/Android, registro SW al final del <script>
```

Registro del service worker (al final del bloque `<script>` principal):
```js
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
```

### Auto-tema por hora

```js
autoThemeByHour()  // Se llama en window.onload, antes de applyTheme()
                   // Si no hay 'gymy_theme' en localStorage: dark antes de 7h y después de 20h, light en medio
                   // Si el usuario selecciona un tema manualmente se guarda en localStorage y prevalece
```

### Importación de historial (import.js)

Funciones principales:
```js
importHistorialCSV(event)           // Entry point desde <input type="file">
openImportPreview(rawText,filename) // Muestra modal de preview con barra de progreso
parsearCSV(rawText)                 // Autodetecta separador y formato → [sesiones]
runImport()                         // Orquesta los 3 pasos: resolver + auto-crear + guardar
_resolverCombinaciones(sesiones)    // Promise → Map | null (modal de combinaciones)
_autoCrearEjercicios(sesiones)      // POST /api/catalogo para ejercicios nuevos (subgrupo: null)
runAIImport(text)                   // Importación vía IA (POST /api/ai/import)
```

**Umbral similitud**: ≥ 80% → preselección automática (`✓ Sugerido`).
**Barra de progreso**: `#import-progress-fill` se actualiza por sesión en `runImport`.

### Skeleton loaders y empty states

**Skeleton** (mientras carga):
```html
<div class="skeleton skel-session"></div>  <!-- tarjeta sesión -->
<div class="skeleton skel-stat"></div>     <!-- stat card -->
```

**Empty state** (sin datos):
```html
<div class="empty-state">
  <img class="empty-state-icon" src="/assets/musculos.svg" alt=""/>
  <div class="empty-state-title">Sin sesiones</div>
  <div class="empty-state-sub">Pulsa ＋ para empezar tu primer entrenamiento</div>
</div>
```

Se usan en `loadHistorial()` y `renderRecientes()`.

### Swipe-to-delete

`sessionCard(s)` genera el HTML envuelto en `.swipe-wrap`:
```html
<div class="swipe-wrap" data-id="123">
  <div class="swipe-del-bg">🗑</div>
  <div class="session-item" style="--s-color:#ef5350">...</div>
</div>
```

`_initSwipeDelete()` activa los listeners touch en cada `.swipe-wrap` nuevo (llamado al final de `loadHistorial`).
Swipe ≥ 60px → `showConfirm` → `eliminarSesion(id)` → animación de collapse → `loadDashboard()`.

### Variables CSS de color de sesión

Cada `.session-item` tiene `--s-color` inline (del `GRUPO_COLORS` del primer grupo, o del tipo de sesión).
La pseudoclase `::before` usa `var(--s-color)` para la barra lateral.

```js
const GRUPO_COLORS = {
  'Pecho':'#ef5350', 'Espalda':'#42a5f5', 'Piernas':'#66bb6a',
  'Hombros':'#ab47bc', 'Brazos':'#ffa726', 'Core':'#26c6da', 'Cardio':'#ec407a',
};
```

### Coach Sasha — caché del plan

```js
const COACH_PLAN_TTL = 12 * 60 * 60 * 1000; // 12h en ms
// localStorage: _uk('coach_plan') → { text: "...", ts: Date.now() }  (clave privada por usuario)
```

Al abrir el modal del plan: si hay caché válida se muestra directamente con botón "Regenerar".
"Regenerar" llama a `coachPlan(true)` que fuerza nueva llamada a la API.

---

## Actualizar catálogo de ejercicios desde Excel

El catálogo (`ejercicios_catalogo`) se puebla con upsert al arrancar desde `plantillas_ejercicios.json`.
Para actualizarlo cuando se modifica `plantilla_ejercicios.xlsx`:

```bash
cd backend
node excel_to_json.js   # genera plantillas_ejercicios.json
```

El script (`backend/excel_to_json.js`):
- Lee `frontend/assets/plantilla_ejercicios.xlsx` (hoja "Rutina")
- Deduplica y filtra nombres inválidos (artefactos de celdas fusionadas)
- Preserva `subgrupo` y `equipo` de ejercicios ya existentes en el JSON
- Infiere `subgrupo` y `equipo` para ejercicios nuevos por keywords del nombre
- Escribe `frontend/assets/plantillas_ejercicios.json`

Tras generarlo, commitear y pushear a `main`. En el próximo arranque de Railway se hará upsert.

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

```js
(async () => {
  const PAT = 'ghp_...';
  const meta = await fetch('https://api.github.com/repos/epsilom84/GyMy/contents/backend/frontend/index.html',
    { headers: {'Authorization': `token ${PAT}`} }).then(r=>r.json());

  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(meta.content.replace(/\n/g,'')), c => c.charCodeAt(0))
  );
  const modified = decoded.replace('OLD', 'NEW');
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(modified)));

  await fetch('https://api.github.com/repos/epsilom84/GyMy/contents/backend/frontend/index.html', {
    method: 'PUT',
    headers: {'Authorization': `token ${PAT}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({ message: 'fix: descripción', content: b64, sha: meta.sha })
  }).then(r=>r.json()).then(d => console.log(d.commit?.sha));
})();
```

---

## Convenciones de código

### General
- **Sin TypeScript**, sin transpilación, sin bundler. JS vanilla en frontend, CommonJS en backend.
- **Sin ORM**. SQL directo con `queryOne` / `queryAll` / `withTransaction`.
- **Sin frameworks CSS**. CSS custom properties para temas (`--bg`, `--accent`, etc.).
- El frontend es una SPA. Los cambios de pantalla son manipulación de DOM con `.page.active`.
- Toda la lógica de autenticación usa `localStorage` para tokens en el cliente.
- Los iconos de ejercicio se sirven desde `/assets/` — imágenes estáticas.

### Estructura de archivos
- **Un módulo JS por pantalla o dominio** — no añadir código a `index.html`.
- **CSS separado del HTML y del JS** — los estilos van en `css/`.
- Cada módulo nuevo se carga con `<script src="/js/modulo.js">` en `index.html`, en el orden correcto (dependencias primero).
- Las funciones necesarias en múltiples módulos se declaran en `js/app.js` o `js/store.js`.
- Los módulos no usan `import`/`export` (compatibilidad máxima sin bundler); las funciones públicas se asignan a `window` cuando sea necesario.

### Backend
- Las rutas se organizan por dominio. Si `gym.routes.js` supera ~600 líneas, extraer en subrutas (`sesiones.routes.js`, `plantillas.routes.js`, etc.) y montarlas en `server.js`.
- Cada endpoint valida que el recurso pertenece al usuario autenticado (`WHERE id=$1 AND user_id=$2`).

### Privacidad y datos de usuario
- Todos los datos sensibles en `localStorage` se prefijan con el userId mediante `_uk(key)`.
- Las cachés en memoria se limpian en `_clearUserCaches()` antes de cualquier logout.
- Claves no sensibles que pueden ser compartidas entre cuentas: `gymy_theme`, `gymy_preload`.

---

## Errores comunes a evitar

- ❌ No añadir lógica de negocio o CSS en `index.html` — usar los módulos `js/` y `css/`
- ❌ No usar `sqlite3` — la app usa PostgreSQL
- ❌ No importar `DATABASE_PUBLIC_URL` — usar siempre `DATABASE_URL`
- ❌ No hacer `process.exit(1)` en middleware — solo en `initDB()` si falla la conexión
- ❌ No mover las rutas `/api/catalogo/*` después de `router.use(verifyToken)`
- ❌ No usar `btoa()` directamente con texto UTF-8 (rompe emojis y acentos)
- ❌ No usar `apiCall()` para `/api/catalogo` (dobla el prefijo `/api`)
- ❌ No llamar `wkGetDB()` antes de que las cachés estén listas — usar `wkGetDBAsync()`
- ❌ No borrar `pool` del export de `init.js` — `gym.routes.js` lo usa para DELETE masivos
- ❌ No enviar `subgrupo: e.grupo_muscular` en `_autoCrearEjercicios` — enviar `subgrupo: null`
- ✅ El server escucha en `0.0.0.0` (necesario para Railway)
- ✅ SSL condicional: interno Railway = false, externo = `{ rejectUnauthorized: false }`
- ✅ Usar `formatFecha()` para mostrar fechas de la BD al usuario
- ✅ Llamar `invalidatePlantillas()` después de cualquier POST/DELETE a `/api/plantillas`
- ✅ Llamar `_initSwipeDelete()` después de renderizar tarjetas de sesión en el historial
- ✅ Usar upsert (`ON CONFLICT DO UPDATE`) en el seed del catálogo — nunca `DELETE` + `INSERT`

# currentDate
Today's date is 2026-03-12.
