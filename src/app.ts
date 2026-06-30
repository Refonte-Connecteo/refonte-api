import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
// import { Prisma } from './src/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import routes from '@/routes/index';
import { ValidationError, NotFoundError } from '@/errors/index';

const app = express();

app.use(express.json());
app.use(cookieParser());

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

app.use('/api', routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route introuvable',
  });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const error = err as Error & { statusCode?: number; isOperational?: boolean; errors?: Record<string, string> };

  if (error.isOperational) {
    const body: Record<string, unknown> = { error: error.message };
    if (error instanceof ValidationError && error.errors) {
      body.errors = error.errors;
    }
    res.status(error.statusCode!).json(body);
    return;
  }

  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
  });
});

export default app;
