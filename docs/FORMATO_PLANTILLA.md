# Formato de plantilla (JSON) — Design App

Cada plantilla se describe en un JSON y tiene una **imagen base** (PNG) en `storage/plantillas/`. El backend usa Sharp para superponer textos e imágenes según las capas definidas.

---

## Estructura del JSON

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador único de la plantilla (ej. `aviso-interno-01`). |
| `nombre` | string | Nombre visible para el usuario. |
| `tipo` | string | Tipo de comunicado: `aviso`, `banner`, `email`, `redes`, `cartel`, etc. |
| `dimensiones` | object | `{ ancho: number, alto: number }` en píxeles. |
| `capas` | array | Lista de capas (texto, fecha, imagen). |

---

## Capas (`capas[]`)

Cada capa tiene al menos: `id`, `tipo`. El `id` es la clave con la que se envían los valores en `datos` al endpoint `/api/componer`.

### Campos comunes a todas las capas

- **`id`** (string): Identificador único de la capa; debe coincidir con la clave en `datos`.
- **`tipo`** (string): `texto`, `texto_largo`, `titulo`, `cta`, `fecha`, `imagen`, `imagen_gemini`, `personaje`.
- **`left`** (number): Posición X en píxeles desde la izquierda (opcional; por defecto 40).
- **`top`** (number): Posición Y en píxeles desde arriba (opcional; por defecto 100).
- **`ancho`** (number): Ancho del área de la capa (opcional).
- **`alto`** (number): Alto del área de la capa (opcional).

### Capas de texto

- **`maxCaracteres`** (number): Límite de caracteres (opcional).
- **`tamano`** (number): Tamaño de fuente en px (opcional; por defecto 48).
- **`color`** (string): Color del texto en hex (opcional; por defecto `#000000`).
- **`fuente`** (string): Nombre de fuente (opcional; por ahora el backend usa Arial).

Para tipo `fecha` se puede usar **`formato`** (ej. `d MMM yyyy`); el valor en `datos` puede ser fecha ISO o string.

### Capas de imagen

- **`tipo`**: `imagen`, `imagen_gemini` o `personaje`.
- En `datos`, el valor puede ser: ruta relativa a `storage/assets/`, Base64 (`data:image/...;base64,...`) o buffer (en peticiones con multipart).

---

## Ejemplo mínimo

```json
{
  "id": "aviso-interno-01",
  "nombre": "Aviso cuadrado redes",
  "tipo": "aviso",
  "dimensiones": { "ancho": 1080, "alto": 1080 },
  "capas": [
    { "id": "titulo", "tipo": "texto", "left": 40, "top": 80, "maxCaracteres": 60, "tamano": 48, "color": "#1a1a1a" },
    { "id": "cuerpo", "tipo": "texto_largo", "left": 40, "top": 180, "ancho": 1000, "alto": 400, "maxCaracteres": 280, "tamano": 24 },
    { "id": "fecha", "tipo": "fecha", "left": 40, "top": 620, "formato": "d MMM yyyy", "tamano": 18 },
    { "id": "imagen_principal", "tipo": "imagen_gemini", "left": 700, "top": 200, "ancho": 340, "alto": 340 }
  ]
}
```

La **imagen base** debe estar en `storage/plantillas/`, por ejemplo `aviso-interno-01-base.png`. En la tabla `plantillas` (BD), el campo `ruta_imagen_base` sería `aviso-interno-01-base.png`.

---

## Uso con el endpoint POST /api/componer

Body de ejemplo:

```json
{
  "plantillaId": "aviso-interno-01",
  "datos": {
    "titulo": "Nuevo horario de atención",
    "cuerpo": "A partir del 1 de abril nuestro horario será de 9:00 a 18:00.",
    "fecha": "2026-04-01"
  },
  "formato": "png"
}
```

O pasando la plantilla inline (sin guardarla antes en BD):

```json
{
  "plantilla": {
    "definicion": { ... },
    "ruta_imagen_base": "mi-plantilla-base.png"
  },
  "datos": { "titulo": "Hola", "cuerpo": "Mundo" },
  "formato": "png"
}
```

---

## Exportar desde Illustrator

1. Crea el diseño con capas nombradas según los `id` de las capas (opcional; el posicionamiento se controla por `left`/`top` en el JSON).
2. Exporta la **imagen base** (fondo sin textos dinámicos) como PNG a `storage/plantillas/`.
3. Define el JSON con las mismas dimensiones y las capas con posiciones aproximadas (puedes ajustar `left`/`top` probando con `/api/componer`).
