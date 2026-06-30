import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import * as contactController from '@/controllers/contact.controller';
import { ValidationError } from '@/errors/index';

const mockPrisma = vi.hoisted(() => ({
  contact_message: {
    create: vi.fn(),
  },
}));

const mockSendContactEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/services/email.service', () => ({
  sendContactEmail: mockSendContactEmail,
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

const validBody = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '+33123456789',
  company: 'Acme',
  country: 'France',
  message: 'Hello, I would like to get in touch.',
};

describe('contactController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submit', () => {
    it('creates contact message, sends email, and returns 201', async () => {
      const req = mockReq({ body: validBody });
      const res = mockRes();
      const next = vi.fn();

      const createdMessage = { id: 1, ...validBody };
      mockPrisma.contact_message.create.mockResolvedValue(createdMessage);
      mockSendContactEmail.mockResolvedValue(undefined);

      contactController.submit(req, res, next);
      await flush();

      expect(mockPrisma.contact_message.create).toHaveBeenCalledWith({
        data: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+33123456789',
          company: 'Acme',
          country: 'France',
          message: 'Hello, I would like to get in touch.',
        },
      });
      expect(mockSendContactEmail).toHaveBeenCalledWith(validBody);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('throws ValidationError when data is invalid', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = vi.fn();

      contactController.submit(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
    });

    it('still returns 201 when email sending fails', async () => {
      const req = mockReq({ body: validBody });
      const res = mockRes();
      const next = vi.fn();

      const createdMessage = { id: 1, ...validBody };
      mockPrisma.contact_message.create.mockResolvedValue(createdMessage);
      mockSendContactEmail.mockRejectedValue(new Error('SMTP error'));

      contactController.submit(req, res, next);
      await flush();

      expect(mockPrisma.contact_message.create).toHaveBeenCalled();
      expect(mockSendContactEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
