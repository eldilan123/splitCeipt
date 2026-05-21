# SplitCeipt — CLAUDE.md

## ¿Qué es este proyecto?

SplitCeipt es una web app para dividir cuentas de restaurante entre amigos.
El diferencial es el escáner de recibo con IA: el usuario toma foto del recibo
y la IA extrae automáticamente los items, precios, propina e impuestos.
El usuario solo decide quién pidió qué.

**Tagline:** "El recibo. Dividido. En segundos."

---

## Stack técnico

- **Frontend:** Vite + Vanilla JS + CSS custom (sin frameworks)
- **Backend:** Vercel Serverless Functions (Node.js)
- **IA:** Anthropic API — modelo `claude-haiku-4-5-20251001` para OCR de recibos
- **Pagos:** Wompi (Colombia) — integración futura
- **Hosting:** Vercel (gratis)
- **PWA:** manifest.json + service worker para instalación móvil

---

## Estructura del proyecto

```
splitceipt/
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── vercel.json
├── package.json
├── vite.config.js
│
├── api/
│   └── scan.js              # Serverless function — proxy a Anthropic API
│
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   ├── icon-192.png         # App icon
│   └── icon-512.png         # App icon
│
└── src/
    ├── index.html           # Entry point
    ├── main.js              # Lógica principal
    ├── style.css            # Estilos globales
    └── modules/
        ├── scanner.js       # Lógica de escaneo IA
        ├── items.js         # Gestión de items
        ├── people.js        # Gestión de personas
        ├── calculator.js    # Cálculo de divisiones
        ├── share.js         # Compartir resultado (WhatsApp, copiar)
        └── storage.js       # localStorage — contador de scans, historial
```

---

## Variables de entorno

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...   # Nunca exponer al frontend
```

En Vercel: Settings → Environment Variables → `ANTHROPIC_API_KEY`

---

## API endpoint — /api/scan.js

Recibe imagen en base64 desde el frontend, llama a Anthropic, devuelve JSON estructurado.

**Request:**
```json
{
  "image": "<base64>",
  "mediaType": "image/jpeg"
}
```

**Response:**
```json
{
  "items": [
    { "name": "Bandeja paisa", "price": 32000 }
  ],
  "tip_pct": 10,
  "tip_fixed": 0,
  "tax_pct": 0,
  "discount": 0,
  "subtotal": 85000,
  "total": 93500,
  "currency": "COP",
  "notes": "Recibo legible, 3 items detectados"
}
```

**Reglas del endpoint:**
- Modelo siempre: `claude-haiku-4-5-20251001` (no usar sonnet — costo)
- max_tokens: 1000
- Si la imagen no es un recibo, devolver `{ items: [], notes: "No es un recibo" }`
- Si hay error de API, devolver `{ error: true, message: "..." }`
- CORS habilitado para el dominio de producción

---

## Modelo de monetización

### Freemium
| Plan | Precio | Scans IA/mes | Features |
|------|--------|--------------|----------|
| Gratis | $0 | 3 | Manual ilimitado, WhatsApp share, con anuncios |
| Pro | $1.99 USD/mes | Ilimitados | Sin anuncios, historial, export PDF |
| Grupos | $4.99 USD/mes | Ilimitados | Todo Pro + grupos guardados, deudas entre amigos |

### Contador de scans (localStorage)
```js
// storage.js
const SCAN_KEY = 'sc_scans'
const RESET_KEY = 'sc_reset'
const FREE_LIMIT = 3

// Estructura:
{
  count: 2,           // scans usados este mes
  resetDate: "2026-06"  // mes actual — resetea al cambiar
}
```

Cuando `count >= FREE_LIMIT` y el usuario no es Pro → mostrar modal de upgrade.

### AdSense
- Un solo banner 320x100 debajo del resultado final
- Jamás interrumpir el flujo principal
- Solo mostrar a usuarios del plan Gratis

---

## PWA — comportamiento esperado

- Instalable en Android e iOS ("Agregar a pantalla de inicio")
- Funciona offline para modo manual (sin IA)
- Modo IA requiere conexión (llama al backend)
- Ícono naranja con letra "S" en blanco (colores de marca)

---

## Diseño y marca

### Paleta de colores
```css
--accent: #E8450A;      /* naranja principal — botones CTA */
--accent2: #FF6B35;     /* naranja hover */
--bg: #F5F2EC;          /* fondo cálido */
--surface: #FDFBF7;     /* cards */
--ink: #1A1814;         /* texto principal */
--ink2: #6B6760;        /* texto secundario */
--purple: #7B5CF5;      /* acento IA — badges, botón escanear */
--green: #1A7A4A;       /* éxito, totales */
```

### Tipografía
- Headlines: `Syne` (Google Fonts) — 800 weight
- Body: `DM Sans` (Google Fonts) — 300/400/500

### Tono de voz
- Informal, directo, en español colombiano
- Sin tecnicismos innecesarios
- Mensajes de error amigables ("Algo salió mal, intenta de nuevo 😅")

---

## Flujo principal (5 pasos)

```
1. Personas    → agregar quiénes dividen (mín 2, máx 10)
2. Recibo      → elegir: escanear con IA O ingresar manual
3. Items       → asignar quién pidió qué (multi-select por item)
4. Extras      → propina, impuesto, descuento (auto-llenado si vino de IA)
5. Resultado   → breakdown por persona + compartir WhatsApp
```

---

## Reglas de desarrollo

### Siempre
- Usar `claude-haiku-4-5-20251001` en el backend — nunca sonnet
- La API key va SOLO en el backend (`/api/scan.js`)
- Validar tamaño de imagen antes de enviar (máx 10MB)
- Mostrar estados de carga en cualquier operación async
- Formatear precios con `toLocaleString('es-CO')` → `$32.000`

### Nunca
- Exponer `ANTHROPIC_API_KEY` en el frontend
- Usar frameworks pesados (React, Vue) — vanilla JS es suficiente
- Bloquear el UI thread durante el escaneo
- Guardar imágenes del recibo en ningún lado (privacidad)

### Manejo de errores
- Error de API → toast amigable + opción de reintentar
- Imagen ilegible → sugerir tomar mejor foto o ingresar manual
- Sin conexión → deshabilitar botón de IA con mensaje claro
- Scan limit alcanzado → modal de upgrade (nunca error feo)

---

## Skills de Claude Code a usar en este proyecto

| Tarea | Skill |
|-------|-------|
| Planear arquitectura | `writing-plans` |
| Ejecutar el plan | `executing-plans` |
| Componentes UI | `frontend-design` |
| Bug difícil | `systematic-debugging` |
| Antes de cada PR | `requesting-code-review` |
| Antes de deploy | `verification-before-completion` |
| Cerrar feature | `finishing-a-development-branch` |

---

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build
npm run build

# Deploy a Vercel
vercel --prod

# Probar API local
vercel dev   # levanta las serverless functions localmente
```

---

## Roadmap

### v1.0 — MVP (semana 1-2)
- [x] UI completa (5 pasos)
- [x] Escaneo con IA (Claude Haiku)
- [x] Modo manual
- [x] Share WhatsApp
- [ ] Deploy en Vercel con dominio
- [ ] AdSense configurado

### v1.1 — Freemium (mes 2)
- [ ] Contador de scans en localStorage
- [ ] Modal de upgrade
- [ ] Integración Wompi para pagos
- [ ] Historial de divisiones

### v1.2 — PWA + Mobile (mes 3)
- [ ] Service worker completo
- [ ] App instalable
- [ ] Publicar en Play Store (Capacitor.js)

### v2.0 — Social (mes 4+)
- [ ] Grupos guardados
- [ ] Tracker de deudas entre amigos
- [ ] Notificaciones de pago pendiente
- [ ] Integración Nequi/Daviplata
