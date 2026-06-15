import express, { Request, Response, NextFunction } from 'express';

const app = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'API Express en ligne',
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route introuvable',
  });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
  });
});

export default app;
