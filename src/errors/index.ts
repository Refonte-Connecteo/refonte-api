export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Ressource") {
    super(`${resource} introuvable`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Non autorisé") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Accès refusé") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflit") {
    super(message, 409);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Requête invalide") {
    super(message, 400);
  }
}
