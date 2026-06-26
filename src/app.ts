import express, { Request, Response, NextFunction } from 'express';

const app = express();

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'API Express en ligne',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route introuvable',
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
  });
});

export default app;
