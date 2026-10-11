# Arquitectura

Weight Tracker es una SPA estática servida por GitHub Pages, sin paso de build. El código usa
**módulos ES nativos** (`<script type="module">`), Firebase (Auth + Firestore) desde el CDN de
gstatic y Chart.js como global (`window.Chart`) desde cdnjs.

Mantener "sin build" es una decisión deliberada: el workflow de despliegue sube el repo tal cual.
Toda la estructura de abajo funciona directamente en el navegador.

## Estructura de carpetas

```
index.html                 Markup de la app. Solo enlaza estilos y src/main.js.
assets/                    Imágenes estáticas (icono).
styles/                    CSS separado por responsabilidad (ver "Estilos").
src/
  main.js                  Punto de entrada: arranca el shell y conecta las features.
  config/
    firebase.js            initializeApp + instancias auth/db. Único sitio con la config.
  lib/                     Utilidades genéricas. NO conocen la app ni Firebase.
    dates.js               Fechas 'YYYY-MM-DD' en UTC: today, addDays, daysBetween, formatos.
    dom.js                 byId, playEnter (animación de entrada).
    html.js                esc() para interpolar texto en HTML.
    confirm-tap.js         Patrón "toca otra vez para confirmar".
    storage.js             localStorage tolerante a fallos.
    clipboard.js           copyText con fallback.
  shared/                  Servicios de la app compartidos por varias features.
    user-db.js             Referencias Firestore bajo users/{uid}/…
    sync-status.js         Indicador "Saving… / Saved / Error" y persist().
    theme.js               Colores usados desde JS (gráficas).
    export-format.js       Helpers de texto plano para el export (reglas, padding).
  shell/                   El "marco" de la app, común a todas las secciones.
    auth.js                Login/logout y pantallas según la sesión.
    profile-menu.js        Menú del avatar.
    router.js              Rutas por hash (#/bodyweight, #/exercises).
    export.js              Export a portapapeles (combina ambas features).
  features/
    bodyweight/            Sección Bodyweight (peso corporal y objetivos).
    exercises/             Sección Exercises (días, ejercicios, series, deloads).
```

### Capas y reglas de dependencia

```
main.js ──► shell/ ──► features/ ──► shared/ ──► lib/
                                       │
                                       └──► config/
```

- `lib/` no importa nada del proyecto. Es reutilizable y fácil de testear.
- `shared/` puede importar `lib/` y `config/`.
- Una feature importa `lib/` y `shared/`, **nunca otra feature**. Si dos features necesitan
  algo, sube a `shared/`.
- `shell/` orquesta: es el único que conoce ambas features (router, export, sesión).
- Cada feature expone su API pública **solo** desde su `index.js`. El resto de archivos de la
  feature son internos.

## Anatomía de una feature

Todas siguen el mismo esquema, para que añadir una sección nueva sea copiar el patrón:

| Archivo           | Responsabilidad                                                        |
|-------------------|------------------------------------------------------------------------|
| `index.js`        | API pública: `init`, `load`, `clear`, `export…`. Registra los eventos. |
| `state.js`        | Estado en memoria de la feature (un objeto mutable exportado).         |
| `repository.js`   | Lectura/escritura en Firestore. Sin DOM.                               |
| lógica pura       | Cálculos sin DOM ni Firebase (`stats.js`, `selectors.js`, …).          |
| `views/`          | Funciones que pintan el DOM a partir del estado.                       |
| `export.js`       | Sección de texto plano para el export.                                 |

El estado es un objeto exportado (`state.entries`, `state.goal`…) en lugar de variables sueltas:
los módulos ES no permiten reasignar un `let` importado, y así todos ven el mismo valor.

### features/bodyweight

```
index.js               initBodyweight, loadBodyweight, clearBodyweight, renderBodyweight
state.js               entries, goal, goalHistory, pendingReset, chartRange
repository.js          CRUD de entries, goal y goalHistory
stats.js               Serie diaria interpolada, medias de 7 días, umbrales de datos (puro)
goal-plan.js           Cálculo del plan de un objetivo y su archivado (puro)
render.js              Render principal: llama a cada vista
views/
  overview-stats.js    Las tres tarjetas de medias
  goal-banner.js       Banner del objetivo (ritmo, proyección, barras, alcanzado/vencido)
  weekly-summary.js    Tabla semanal
  history.js           Pestaña Log: alta, edición y borrado de entradas
  goal-tab.js          Pestaña Goal: formulario, preview, resumen y objetivos pasados
  tabs.js              Pestañas Overview / Log / Goal
chart/
  weight-chart.js      Crea/actualiza la gráfica y el selector de rango
  chart-data.js        Eje de días, ventana del rango y datasets (peso + ritmo ideal)
  chart-view.js        Estado de la gráfica y layout de la ventana (bounds X/Y, scroll)
  zoom-animation.js    Animación de zoom al cambiar de rango
  zoom-planner.js      Planificación suave del eje Y durante el zoom (puro)
export.js
```

### features/exercises

```
index.js               initExercises, loadExercises, clearExercises, resetExercisesMode, exportSections
state.js               Datos (days, exercises, logs, deloads) + estado de UI (modo, formularios)
constants.js           Límites, colores por serie, iconos SVG
repository.js          Carga, persist por lotes y serializadores
selectors.js           Consultas sobre el estado: ordenar, filtrar, última carga, "hecho hoy"
deloads.js             Ciclo de deload: actual, siguiente, anterior, fase
modes.js               View / Edit / Train
folds.js               Plegado persistente y "Expand all"
charts.js              Gráficas por ejercicio
form-readers.js        Lectura y validación de formularios
actions.js             Manejador de data-action (delegación de eventos)
export.js
views/
  render.js            Render principal del árbol
  components.js        Botones e iconos reutilizables
  tree.js              Día → ejercicio → serie → historial
  forms.js             Formularios de log y de ejercicio
  deload.js            Tarjeta de deload
  train.js             Modo Train
```

## Estilos

Mismo criterio que en JS: un archivo por responsabilidad, cargados en este orden desde
`index.html` (el orden importa para la cascada):

```
styles/
  tokens.css           Variables CSS de color. Cambiar el tema = tocar esto (y shared/theme.js).
  base.css             Reset, body, animaciones globales.
  components.css       Piezas reutilizables: card, btn, inputs, chip, fold, icon-btn…
  layout.css           Shell: top bar, menú de perfil, cabecera, pestañas, sync.
  login.css            Pantalla de login.
  bodyweight.css       Sección Bodyweight (incluye su layout de escritorio).
  exercises.css        Sección Exercises (árbol, formularios, deload, gráficas).
  train.css            Modo Train.
```

Los estilos inline que se generaban desde JS pasan a clases CSS; JS solo alterna clases.

## Cómo crecer

- **Nueva sección** (p. ej. "Nutrition"): crear `src/features/nutrition/` con el esquema de
  arriba, un `styles/nutrition.css`, añadir la ruta en `shell/router.js` y conectar
  `load/clear` en `main.js`.
- **Nueva utilidad**: si no sabe nada de la app → `lib/`. Si usa Firebase o el indicador de
  sync → `shared/`.
- **Tamaño de archivo**: si un módulo pasa de ~300 líneas o mezcla DOM con cálculo, partirlo
  (p. ej. `exercises/actions.js` en un archivo por entidad si sigue creciendo).
