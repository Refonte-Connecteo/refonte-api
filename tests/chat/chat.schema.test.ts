import { describe, it, expect } from 'vitest';
import { chatSchema } from '@/schemas/chat.schema';

describe('chatSchema', () => {
  it('accepts a valid message', () => {
    const result = chatSchema.safeParse({ message: 'Bonjour' });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = chatSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing message', () => {
    const result = chatSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects message over 4000 characters', () => {
    const result = chatSchema.safeParse({ message: 'a'.repeat(4001) });
    expect(result.success).toBe(false);
  });

  it('accepts message of exactly 4000 characters', () => {
    const result = chatSchema.safeParse({ message: 'a'.repeat(4000) });
    expect(result.success).toBe(true);
  });

  it('rejects non-string message', () => {
    const result = chatSchema.safeParse({ message: 123 });
    expect(result.success).toBe(false);
  });
});
