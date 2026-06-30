import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleChat } from '@/controllers/chat.controller';
import { ValidationError } from '@/errors/index';

const mockGetChatResponse = vi.hoisted(() => vi.fn());

vi.mock('@/services/chat.service', () => ({
  getChatResponse: mockGetChatResponse,
}));

function mockReq(body: unknown): Request {
  return { body } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('handleChat', () => {
  beforeEach(() => {
    mockGetChatResponse.mockReset();
  });

  it('returns the reply on valid input', async () => {
    const req = mockReq({ message: 'Bonjour' });
    const res = mockRes();
    const next = vi.fn();

    mockGetChatResponse.mockResolvedValue('Salut !');

    await handleChat(req, res, next);

    expect(mockGetChatResponse).toHaveBeenCalledWith('Bonjour');
    expect(res.json).toHaveBeenCalledWith({ reply: 'Salut !' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with ValidationError when message is empty', async () => {
    const req = mockReq({ message: '' });
    const res = mockRes();
    const next = vi.fn();

    await handleChat(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
    expect(mockGetChatResponse).not.toHaveBeenCalled();
  });

  it('calls next with ValidationError when message is missing', async () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();

    await handleChat(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  it('calls next with ValidationError when message exceeds 4000 characters', async () => {
    const req = mockReq({ message: 'a'.repeat(4001) });
    const res = mockRes();
    const next = vi.fn();

    await handleChat(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  it('includes field-level errors in ValidationError', async () => {
    const req = mockReq({ message: '' });
    const res = mockRes();
    const next = vi.fn();

    await handleChat(req, res, next);

    const err = next.mock.calls[0][0] as ValidationError;
    expect(err.errors).toBeDefined();
    expect(err.errors!.message).toBeDefined();
  });

  it('calls next with service errors', async () => {
    const req = mockReq({ message: 'Bonjour' });
    const res = mockRes();
    const next = vi.fn();

    const error = new Error('Gemini API error: 500');
    mockGetChatResponse.mockImplementation(() => { throw error; });

    await handleChat(req, res, next);

    expect(mockGetChatResponse).toHaveBeenCalledWith('Bonjour');
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBe(error);
  });
});
