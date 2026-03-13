# 🏋️ GyMy

**App web personal de registro de entrenamientos.** Autenticación por usuario, historial completo, estadísticas de progreso, workout activo con timer y detector de PR, catálogo de 262 ejercicios desde BD, plantillas personales, coach IA, soporte offline, PWA instalable y temas visuales.

🔗 **Producción**: https://gymy-production.up.railway.app/

---

## 🗂 Estructura

```
gymy/
├── CLAUDE.md               ← Guía técnica para Claude Code (léela primero)
├── README.md               ← Este archivo
├── subir_github.bat        ← Script Windows para push a GitHub
└── backend/                ← Servidor Node.js (se despliega en Railway)
    ├── server.js           ← Entry point Express
    ├── package.json
    ├── .env.example        ← Variables de entorno de ejemplo
    ├── excel_to_json.js    ← Script: genera plantillas_ejercicios.json desde Excel
    ├── check_dupes.js      ← Utilidad: detecta duplicados en el Excel
    ├── database/
    │   ├── init.js         ← Pool PostgreSQL + schema + seeds (upsert, no borra)
    │   └── migrate_ejercicios_catalogo.js ← Script standalone catálogo
    ├── middleware/
    │   └── verifyToken.js
    ├── routes/
    │   ├── auth.routes.js  ← /api/auth/*
    │   └── gym.routes.js   ← /api/catalogo/* (público) + /api/* (JWT)
    └── frontend/
        ├── index.html      ← SPA completa (~3500 líneas)
        ├── import.js       ← Lógica de importación de historial (extraída de index.html)
        ├── api.js          ← Cliente HTTP
        ├── sw.js           ← Service Worker (PWA)
        ├── manifest.json   ← Web App Manifest (PWA)
        └── assets/
            ├── icon.svg                    ← Icono app (mancuerna)
            ├── musculos.svg                ← Ilustración cuerpo humano
            ├── plantillas_ejercicios.json  ← 262 ejercicios (fuente del catálogo)
            ├── plantilla_ejercicios.xlsx   ← Excel fuente del catálogo
            ├── equipo/                     ← SVGs de equipamiento
            └── descarga.jpeg              ← Icono personalizado: Sentadilla Barra
```

---

## ⚙️ Instalación local

```bash
cd backend
npm install
cp .env.example .env   # editar variables
node server.js
# → http://localhost:3000
```

### Variables `.env`

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Clave access token |
| `JWT_REFRESH_SECRET` | Clave refresh token |
| `JWT_EXPIRES_IN` | Duración token (ej: `15m`) |
| `NODE_ENV` | `production` o `development` |
| `PORT` | Puerto (Railway lo sobreescribe) |
| `ANTHROPIC_API_KEY` | Para la Coach Sasha (plan de entrenamiento IA) |

---

## 🚀 Despliegue Railway

1. Push a rama `main` en GitHub → Railway redespliega automáticamente
2. En Railway: **Root Directory** → `backend`
3. Añadir las variables de entorno de la tabla anterior
4. Railway crea `DATABASE_URL` automáticamente si añades un PostgreSQL plugin

> El servidor configura `trust proxy = 1` para que `express-rate-limit` funcione correctamente detrás del proxy de Railway.

---

## 📲 PWA (Progressive Web App)

GyMy es instalable como app nativa en iOS y Android:

- **`manifest.json`**: nombre, colores, icono, modo standalone
- **`sw.js`**: service worker con cache-first para assets, network-first para HTML, bypass en `/api/`
- Meta tags para iOS (`apple-mobile-web-app-capable`) y Android (`theme-color`)
- Icono SVG (`/assets/icon.svg`) — mancuerna sobre fondo oscuro

En Chrome/Safari: *Añadir a pantalla de inicio* o instalar desde el navegador.

---

## 📱 Pantallas

### 🔐 Auth
- Login con **Recordarme** (persiste email)
- Registro y recuperación de contraseña por email

### 🏠 Dashboard
- Estadísticas: sesiones totales, racha, horas, sesiones esta semana
- Gráfica de progreso últimas 8 semanas + lista de sesiones recientes
- **Coach Sasha**: frases motivacionales basadas en estadísticas reales; pulsación larga genera plan de entrenamiento personalizado vía API de Claude; el plan se **cachea 12h** en `localStorage`
- Skeleton loaders mientras se cargan los datos; empty state ilustrado si no hay sesiones

### 🏋️ Workout activo
- Selecciona grupo muscular → ejercicio del **catálogo desde BD** → registra series
- **Preload de series**: precarga todas las series del último entrenamiento o del de máximo volumen
- **Timer de descanso** con **progress ring SVG** animado; se activa al marcar ✓
- **Dots de progreso** (●○○○) encima de cada ejercicio — verde = completada, amarillo = PR
- **Steppers de kg/reps** en Bebas Neue 22px para leer desde lejos en el gimnasio
- **Detector de PR** en tiempo real con badge y toast
- **Haptic feedback**: vibración corta al marcar serie, triple al PR, al acabar timer
- Botón "+" para crear ejercicio nuevo y añadirlo al catálogo personal
- **Iconos personalizados** por ejercicio — actualmente: Sentadilla Barra
- Tab "Workout" persiste hasta guardar o descartar

### 📋 Historial
- **Buscador en tiempo real** contra toda la BD: tipo, notas, ejercicios, fechas (3 formatos)
- Filtros por **tipo de sesión** y por **grupo/subgrupo muscular** (chips dinámicos desde BD)
- **Swipe-to-delete**: deslizar tarjeta a la izquierda → papelera roja → confirmación
- **Barra de acento** lateral en cada tarjeta (color según grupo muscular)
- Skeleton loaders y empty states ilustrados con `musculos.svg`
- Modal de detalle: fecha, duración, calorías, valoración, notas y ejercicios con series expandibles
- **Repetir Workout**: recarga ejercicios y pesos al workout activo
- **Exportar CSV**, **Importar historial** (con barra de progreso), **Eliminar todo**

#### Importación de historial

| Aspecto | Detalle |
|---|---|
| Separadores | Tab, `;`, `|`, `,` — autodetectado |
| Formatos de fecha | `DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, ISO |
| Agrupación | Una sesión por día; series del mismo ejercicio se agrupan |
| Catálogo | Añade automáticamente ejercicios nuevos (`subgrupo: null`) |
| Progreso | Barra de progreso durante la importación |

Formatos compatibles: GyMy propio, Gymbook, Hevy, Strong, o cualquier CSV/TSV con fecha y ejercicio.

#### Resolución de ejercicios desconocidos

Antes de guardar, si el archivo tiene ejercicios fuera del catálogo, se abre un modal de resolución ejercicio a ejercicio:
- **Combinar con existente**: candidatos ordenados por similitud. Si ≥ 80% se preselecciona (`✓ Sugerido`).
- **Crear como nuevo**: se añade al catálogo.

Similitud calculada por **bigramas Jaccard** sobre texto normalizado.

### 📊 Stats
- Progresión por ejercicio: peso máximo, volumen máximo, gráfica temporal
- Filtro por grupo/subgrupo muscular
- Distribución por días de la semana

### 👤 Perfil
- Datos personales: edad, género, peso, nivel, objetivo
- **Catálogo completo**: 262 ejercicios agrupados por músculo
- **Mis ejercicios personalizados**: añadir / importar archivo / eliminar
- Configuración: tema visual, modo preload, sync offline
- **Auto-tema**: claro entre 7–20h, oscuro el resto (si no hay preferencia guardada)

---

## 🎨 Diseño y UX

| Mejora | Descripción |
|---|---|
| Skeleton loaders | Placeholders animados (shimmer) mientras cargan datos |
| Empty states | Ilustración `musculos.svg` + texto si no hay sesiones |
| Swipe-to-delete | Deslizar historial → papelera roja → confirmación |
| Progress ring | SVG circular animado en el timer de descanso |
| Dots de series | ●○○○ sobre cada ejercicio del workout |
| Haptic feedback | Vibraciones nativas en acciones clave |
| Slide tabs | Transición horizontal entre pantallas según dirección |
| Drag handle | Pastilla visual en los bottom sheets |
| Auto-tema | Claro/oscuro automático según la hora |
| Barra acento | Línea lateral de color en tarjetas de sesión |

---

## 🤖 Coach Sasha (IA)

- **Frases dinámicas**: basadas en estadísticas reales del usuario
- **Plan personalizado**: pulsación larga → plan semanal con API de Claude (Haiku)
- **Caché 12h** en `localStorage` — botón "Regenerar" para forzar nuevo plan
- Requiere `ANTHROPIC_API_KEY` en Railway

---

## 🎨 Temas

| ID | Nombre |
|---|---|
| `dark` | 🌑 Oscuro (defecto nocturno) |
| `light` | ☀️ Claro (defecto diurno 7–20h) |
| `choni` | 💅 Choni-cani |
| `material-dark` | ◐ Material Dark |
| `material-light` | ○ Material Light |

---

## 💪 Catálogo de ejercicios (262 ejercicios en BD)

| Grupo | Subgrupos |
|---|---|
| Hombros | Deltoides anterior/lateral/posterior |
| Espalda | Dorsal, Lumbar, Trapecio |
| Piernas | Cuádriceps, Femoral, Gemelos, Glúteo |
| Pecho | Pectoral |
| Brazos Bíceps | Bíceps |
| Brazos Tríceps | Tríceps |
| Core | Recto abdominal |

El catálogo se actualiza con **upsert** al arrancar desde `plantillas_ejercicios.json`. Los ejercicios añadidos vía API no se borran al reiniciar.

### Actualizar catálogo desde Excel

```bash
cd backend
node excel_to_json.js   # genera plantillas_ejercicios.json desde plantilla_ejercicios.xlsx
```

Luego commit + push a `main`. Railway hará upsert en el próximo reinicio.

---

## 📶 Offline

- Sesiones guardadas en `localStorage` sin conexión
- Badge naranja con sesiones pendientes
- Sync manual desde Perfil / Sync automático al recuperar conexión
- Shell de la app cacheada por el service worker (funciona sin red)

---

## 🔒 Seguridad

- Contraseñas hasheadas con **bcrypt**
- **JWT**: access token (15 min) + refresh token
- Datos aislados por `user_id` en PostgreSQL
- Rate limiting: 30 req/15min en auth, 120 req/min en el resto
- Endpoints `/api/catalogo/*` públicos (sin JWT)

---

## 🛠 Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML · CSS · JS vanilla (SPA sin frameworks) |
| Backend | Node.js · Express 4 |
| Base de datos | PostgreSQL (Railway) |
| Auth | JWT · bcrypt |
| Deploy | Railway + GitHub (auto-deploy) |
| Gráficas | Chart.js 4 (CDN) |
| IA | API de Claude (Anthropic) — Haiku |
| PWA | Web App Manifest + Service Worker |

> Para detalles técnicos completos (API, schema DB, convenciones de código), ver **[CLAUDE.md](./CLAUDE.md)**.
