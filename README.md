# Design App — Backend + catálogo Fase 2

App interna de comunicados con IA. Backend en Node.js + Express + MySQL + Sharp. Catálogo de plantillas en **React + Vite + Tailwind** (`client/`).

## Requisitos

- Node.js 18+
- MySQL (local o Railway; variables en `.env.example`).

## Instalación (ya hecho si seguiste la preparación)

```bash
npm install
```

## Base de datos

Ejecutar el esquema una sola vez (si no lo has hecho):

```bash
# Desde la raíz design-app, con la contraseña de design_app:
mysql -u design_app -p design_comunicados < db/schema.sql
```

O con variable de entorno (evita escribir la contraseña en la consola):

```bash
MYSQL_PWD=TU_PASSWORD mysql -u design_app design_comunicados < db/schema.sql
```

## Arrancar el servidor (API)

```bash
npm start
```

El servidor queda en `http://localhost:4000` (o el `PORT` de tu `.env`).

## Catálogo web (Fase 2)

En otra terminal:

```bash
npm run client
```

Abre `http://localhost:5173` (el proxy de Vite reenvía `/api` y `/media` al puerto 4000).

## Seed plantillas Fase 2

Tras `migration_fase2.sql` o `schema.sql` actualizado:

```bash
npm run seed
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Info del servicio y lista de endpoints |
| GET | `/health` | Estado del servicio y conexión a MySQL |
| GET | `/media/plantillas/...` | Archivos bajo `storage/plantillas` (miniaturas, bases) |
| GET | `/api/plantillas` | Lista: `categoria`, `red_social`, `formato_redes`, `q`, `usuario_id`; `favoritos=1` + `usuario_id` = solo favoritas |
| GET | `/api/plantillas/:id` | Una plantilla por id o id_externo (`?usuario_id=` para `es_favorito`) |
| GET | `/api/favoritos?usuario_id=` | IDs de plantillas favoritas |
| POST | `/api/favoritos` | Body JSON `{ plantilla_id, usuario_id }` o header `X-User-Id` |
| DELETE | `/api/favoritos/:plantillaId?usuario_id=` | Quitar favorito |
| POST | `/api/componer` | Genera imagen a partir de plantilla + datos (ver abajo) |

## Probar POST /api/componer

Hay una imagen base de ejemplo en `storage/plantillas/base-ejemplo.png`. Puedes probar sin tener plantillas en BD pasando la plantilla en el body:

```bash
curl -X POST http://localhost:4000/api/componer \
  -H "Content-Type: application/json" \
  -d '{
    "plantilla": {
      "definicion": {
        "dimensiones": { "ancho": 1080, "alto": 1080 },
        "capas": [
          { "id": "titulo", "tipo": "texto", "left": 40, "top": 80, "tamano": 48, "color": "#1a1a1a" }
        ]
      },
      "ruta_imagen_base": "base-ejemplo.png"
    },
    "datos": { "titulo": "Mi primer comunicado" },
    "formato": "png"
  }' --output /tmp/comunicado.png
```

## Auth

Por ahora no se valida autenticación (Opción A). El middleware está en `middleware/auth.js`; cuando tengas login real (JWT/sesión/LDAP), se conecta ahí.
