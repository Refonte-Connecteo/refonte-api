import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login } from '@/services/user.services';
import { UnauthorizedError } from '@/errors/index';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuthUtil = vi.hoisted(() => ({
  comparePassword: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/utils/auth.util', () => mockAuthUtil);

const mockUser = {
  id: 1,
  email: 'admin@example.com',
  password_hash: '$2b$12$hashedpassword',
  user_type_id: 1,
  refresh_token: null,
};

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAuthUtil.comparePassword.mockResolvedValue(true);
      mockAuthUtil.generateAccessToken.mockReturnValue('access-token');
      mockAuthUtil.generateRefreshToken.mockReturnValue('refresh-token');
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, refresh_token: 'refresh-token' });

      const result = await login('admin@example.com', 'password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(mockAuthUtil.comparePassword).toHaveBeenCalledWith('password123', mockUser.password_hash);
      expect(mockAuthUtil.generateAccessToken).toHaveBeenCalledWith({
        id: '1',
        email: mockUser.email,
        user_type_id: '1',
      });
      expect(mockAuthUtil.generateRefreshToken).toHaveBeenCalledWith({
        id: '1',
        email: mockUser.email,
        user_type_id: '1',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refresh_token: 'refresh-token' },
      });
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('throws UnauthorizedError when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(login('unknown@example.com', 'password123')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAuthUtil.comparePassword.mockResolvedValue(false);

      await expect(login('admin@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedError);
    });
  });
});
