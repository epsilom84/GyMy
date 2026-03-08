# 🏋️ GyMy

**App web personal de registro de entrenamientos.** Autenticación por usuario, historial completo, estadísticas de progreso, workout activo con timer y detector de PR, soporte offline y temas visuales.

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
    ├── database/
    │   ├── init.js         ← Pool PostgreSQL + schema + seed catálogo
    │   └── migrate_ejercicios_catalogo.js ← Script standalone catálogo
    ├── middleware/
    │   └── verifyToken.js
    ├── routes/
    │   ├── auth.routes.js  ← /api/auth/*
    │   └── gym.routes.js   ← /api/* + /api/catalogo/* (JWT requerido)
    └── frontend/
        ├── index.html      ← SPA completa (toda la app en un archivo)
        ├── actividad.html  ← Vista workout activo
        └── api.js          ← Cliente HTTP
```

---

## ⚙️ Instalación local

```bash
cd backend
npm install
cp ../env.example .env   # editar variables
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
| `ANTHROPIC_API_KEY` | Para importación IA de sesiones |

---

## 🚀 Despliegue Railway

1. Push a rama `main` en GitHub → Railway redespliega automáticamente
2. En Railway: **Root Directory** → `backend`
3. Añadir las variables de entorno de la tabla anterior
4. Railway crea `DATABASE_URL` automáticamente si añades un PostgreSQL plugin

---

## 📱 Pantallas

### 🔐 Auth
- Login con **Recordarme** (persiste email)
- Registro y recuperación de contraseña por email

### 🏠 Dashboard
- Estadísticas: sesiones totales, racha, horas, sesiones esta semana
- Gráfica de progreso últimas 8 semanas + lista de sesiones recientes

### 🏋️ Workout activo
- Selecciona grupo muscular → ejercicio → registra series
- **Preload de pesos**: carga el último peso usado o el de máximo volumen
- **Timer de descanso**: se activa automáticamente al marcar ✓ en una serie
- **Detector de PR** en tiempo real
- Tab "Workout" persiste en la barra de navegación hasta guardar o descartar
- Puedes navegar a otras pantallas sin perder el workout

### 📋 Historial
- Búsqueda y filtros por tipo de sesión
- **Exportar CSV**: descarga todo el historial
- **Importar CSV**: carga sesiones desde archivo (misma fecha = misma sesión)
- **Repetir Workout**: recarga ejercicios y pesos de una sesión anterior
- Formato CSV de importación:
  ```
  fecha,tipo,duracion_min,calorias,ejercicio,series,reps,peso_kg,notas
  ```

### 📊 Stats
- Progresión por ejercicio: peso máximo, volumen máximo, gráfica temporal
- Distribución por días de la semana con filtros

### 👤 Perfil
- Datos personales: edad, género, altura, peso, nivel de actividad, objetivo
- Configuración: tema visual, preload automático, plantillas, sync offline
- Cerrar sesión

---

## 🎨 Temas

| ID | Nombre |
|---|---|
| `dark` | 🌑 Oscuro (defecto) |
| `light` | ☀️ Claro |
| `choni` | 💅 Choni-cani |
| `material-dark` | ◐ Material Dark |
| `material-light` | ○ Material Light |

---

## 💪 Ejercicios por grupo (plantilla por defecto)

| Grupo | Ejercicios |
|---|---|
| Hombros | Press Mancuernas, Elevaciones Laterales (Mancuernas/Máquina/Cable), Face Pull, Press Barra, Press Máquina, Remo Máquina |
| Espalda | Jalón Cerrado/Amplio Cable, Remo Cable Sentado, Remo Máquina, Remo Barra, Remo Polea Unilateral, Pull Down Máquina |
| Piernas | Extensión Máquina, Prensa Inclinada, Press Horizontal, Curl Femoral, Peso Muerto, Sentadilla, Abducción, Aducción, Gemelos |
| Pecho | Press Máquina Frontal, Press Máquina Inclinado, Aperturas Máquina |
| Brazos | Press Tríceps Cuerda, Curl Bíceps (Mancuernas, Scott, Martillo, Alterno) |
| Cardio | Cinta, Bicicleta, Elíptica |

---

## 📶 Offline

- Sesiones guardadas en `localStorage` sin conexión
- Badge naranja con número de sesiones pendientes
- Sync manual desde Perfil → Configuración
- Sync automático al recuperar conexión

---

## 🔒 Seguridad

- Contraseñas hasheadas con **bcrypt**
- **JWT**: access token (15 min) + refresh token (persistente)
- Datos aislados por usuario con `user_id` en PostgreSQL
- Rate limiting: 30 req/15min en auth, 120 req/min en el resto

---

## 🛠 Stack

| | |
|---|---|
| Frontend | HTML · CSS · JS vanilla (SPA sin frameworks) |
| Backend | Node.js · Express 4 |
| Base de datos | PostgreSQL (Railway) |
| Auth | JWT · bcrypt |
| Deploy | Railway + GitHub (auto-deploy) |
| Gráficas | Chart.js 4 (CDN) |

> Para detalles técnicos completos (API, schema DB, convenciones de código), ver **[CLAUDE.md](./CLAUDE.md)**.
