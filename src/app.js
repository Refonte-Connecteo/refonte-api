import express from 'express';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API Express en ligne',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route introuvable',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
  });
});

export default app;