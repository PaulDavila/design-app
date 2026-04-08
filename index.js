require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { authOptional } = require('./middleware/auth');
const healthRouter = require('./routes/health');
const favoritosRouter = require('./routes/favoritos');
const plantillasRouter = require('./routes/plantillas');
const componerRouter = require('./routes/componer');
const nanoBananaRouter = require('./routes/nanoBanana');
const meRouter = require('./routes/me');
const emailEnviosRouter = require('./routes/emailEnvios');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(authOptional);

// Miniaturas e imágenes base de plantillas (ruta_miniatura en BD es relativa a esta carpeta)
app.use(
  '/media/plantillas',
  express.static(path.join(__dirname, 'storage', 'plantillas'), { fallthrough: false })
);

app.use('/health', healthRouter);
app.use('/api/favoritos', favoritosRouter);
app.use('/api/plantillas', plantillasRouter);
app.use('/api/componer', componerRouter);
app.use('/api/nano-banana', nanoBananaRouter);
app.use('/api/me', meRouter);
app.use('/api/email-envios', emailEnviosRouter);

const clientDist = path.join(__dirname, 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
const serveClient = fs.existsSync(clientIndex);

if (serveClient) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/media') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(clientIndex);
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      service: 'design-app',
      version: '1.0.0',
      hint: 'Ejecuta npm run build para servir el cliente (Vite) desde esta misma URL.',
      endpoints: {
        health: 'GET /health',
        media: 'GET /media/plantillas/...',
        favoritos: 'GET|POST|DELETE /api/favoritos',
        plantillas: 'GET /api/plantillas',
        plantillaById: 'GET /api/plantillas/:id',
        componer: 'POST /api/componer',
        nanoBananaGenerate: 'POST /api/nano-banana/generate',
        me: 'GET /api/me?usuario_id=1 (o header X-User-Id)',
        emailEnvios:
          'GET|POST /api/email-envios; GET /api/email-envios/:id; POST /api/email-envios/:id/completar (envío inmediato Email1 + SMTP); DELETE /api/email-envios/:id/descartar',
      },
    });
  });
}

app.listen(PORT, () => {
  console.log(`Design App escuchando en http://localhost:${PORT}`);
});
