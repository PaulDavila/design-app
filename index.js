require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { authOptional } = require('./middleware/auth');
const healthRouter = require('./routes/health');
const favoritosRouter = require('./routes/favoritos');
const plantillasRouter = require('./routes/plantillas');
const componerRouter = require('./routes/componer');
const nanoBananaRouter = require('./routes/nanoBanana');

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

app.get('/', (req, res) => {
  res.json({
    service: 'design-app',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      media: 'GET /media/plantillas/...',
      favoritos: 'GET|POST|DELETE /api/favoritos',
      plantillas: 'GET /api/plantillas',
      plantillaById: 'GET /api/plantillas/:id',
      componer: 'POST /api/componer',
      nanoBananaGenerate: 'POST /api/nano-banana/generate',
    },
  });
});

app.listen(PORT, () => {
  console.log(`Design App escuchando en http://localhost:${PORT}`);
});
