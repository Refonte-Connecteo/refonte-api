import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getChatResponse } from '@/services/chat.service';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

describe('getChatResponse', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns the text from Gemini API on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Bonjour ! Comment puis-je vous aider ?' }],
            },
          },
        ],
      }),
    });

    const reply = await getChatResponse('Salut');
    expect(reply).toBe('Bonjour ! Comment puis-je vous aider ?');
  });

  it('returns empty string when no candidates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    const reply = await getChatResponse('test');
    expect(reply).toBe('');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    });

    await expect(getChatResponse('test')).rejects.toThrow('Gemini API error: 429');
  });

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(getChatResponse('test')).rejects.toThrow('Network error');
  });

  it('calls the correct Gemini endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    });

    await getChatResponse('Hello');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toBe('Hello');
  });
});
