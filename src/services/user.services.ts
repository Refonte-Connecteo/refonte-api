import prisma from '@/lib/prisma';
import { comparePassword } from '@/utils/auth.util';
import { generateAccessToken, generateRefreshToken } from '@/utils/auth.util';
import { UnauthorizedError } from '@/errors/index';

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  const valid = await comparePassword(password, user.password_hash);

  if (!valid) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  const payload = {
    id: String(user.id),
    email: user.email,
    user_type_id: String(user.user_type_id),
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: refreshToken },
  });

  return { accessToken, refreshToken };
}
