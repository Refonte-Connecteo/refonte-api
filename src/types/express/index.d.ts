export interface AdminPayload {
  id: string;
  email: string;
  user_type_id: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}
