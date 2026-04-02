# Fase 2 — Cómo correr y probar (Design App)

## 1. Imágenes (orden recomendado)

Los placeholders **oficiales** para la BD y el compositor viven aquí:

| Uso | Ruta en disco | URL pública (API) |
|-----|---------------|-------------------|
| Imagen base | `storage/plantillas/bases/base.png` | — |
| Miniatura catálogo | `storage/plantillas/miniaturas/miniaturas.png` | `/media/plantillas/miniaturas/miniaturas.png` |

Si aún tienes copias en la raíz de `design-app/` (`base.png`, `miniaturas.png`), puedes borrarlas o dejarlas como respaldo; lo que usa el sistema son las rutas anteriores.

## 2. Base de datos

**Instalación nueva** (crea tablas completas):

```bash
cd design-app
MYSQL_PWD=TU_PASSWORD mysql -u design_app design_comunicados < db/schema.sql
```

**BD ya existente (solo columnas Fase 2)** — una vez:

```bash
MYSQL_PWD=TU_PASSWORD mysql -u design_app design_comunicados < db/migration_fase2.sql
```

> Si la migración falla porque las columnas ya existen, puedes ignorar ese paso.

## 3. Rellenar las 20 plantillas

```bash
cd design-app
npm run seed
```

> **Ojo:** el seed borra e inserta de nuevo `plantillas`, `comunicados` y `plantillas_favoritas`.

## 4. Arrancar backend y frontend (dos terminales)

**Terminal A — API (puerto 4000):**

```bash
cd design-app
npm start
```

Comprueba: [http://localhost:4000/health](http://localhost:4000/health)

**Terminal B — Catálogo React (puerto 5173, proxy a la API):**

```bash
cd design-app
npm run client
```

Abre: [http://localhost:5173](http://localhost:5173)

Navega por **Avisos**, **Newsletter** y **Redes** (portadas, luego red + carrusel/imagen). El corazón usa el usuario demo `usuario_id=1`.

## 5. Probar la API a mano

```bash
# Listado con filtros
curl -s "http://localhost:4000/api/plantillas?categoria=redes_sociales&formato_redes=carrusel&usuario_id=1" | jq length

# Listado solo favoritos
curl -s "http://localhost:4000/api/plantillas?favoritos=1&usuario_id=1" | jq length

# Miniatura
open "http://localhost:4000/media/plantillas/miniaturas/miniaturas.png"

# Favorito
curl -s -X POST http://localhost:4000/api/favoritos \
  -H "Content-Type: application/json" \
  -d '{"plantilla_id":1,"usuario_id":1}'

curl -s "http://localhost:4000/api/favoritos?usuario_id=1"
```

## 6. Build del front (sin proxy)

```bash
cd design-app/client
npm run build
npm run preview
```

Define `VITE_API_URL` si la API no está en el mismo host (por ejemplo `http://localhost:4000`):

```bash
echo 'VITE_API_URL=http://localhost:4000' > client/.env.production
```

---

Ver también el plan general: `../DESIGN_FASE2_PLAN.md` (raíz ABCLOGISTICA).
