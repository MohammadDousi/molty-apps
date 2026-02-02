import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type SessionStore = {
  create: (userId: number) => Promise<string>;
  getUserId: (token: string) => Promise<number | null>;
  revoke: (token: string) => Promise<void>;
};

export const createMemorySessionStore = (): SessionStore => {
  const sessions = new Map<string, { userId: number; createdAt: number }>();

  const create = async (userId: number) => {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, { userId, createdAt: Date.now() });
    return token;
  };

  const getUserId = async (token: string) => {
    const session = sessions.get(token);
    return session?.userId ?? null;
  };

  const revoke = async (token: string) => {
    sessions.delete(token);
  };

  return { create, getUserId, revoke };
};

export const createPrismaSessionStore = (prisma: PrismaClient): SessionStore => {
  const create = async (userId: number) => {
    const token = crypto.randomBytes(24).toString("hex");
    await prisma.ww_session.create({
      data: {
        token,
        user_id: userId
      }
    });
    return token;
  };

  const getUserId = async (token: string) => {
    const session = await prisma.ww_session.findUnique({
      where: { token }
    });

    if (!session) {
      return null;
    }

    await prisma.ww_session.update({
      where: { token },
      data: { last_used_at: new Date() }
    });

    return session.user_id;
  };

  const revoke = async (token: string) => {
    await prisma.ww_session.deleteMany({
      where: { token }
    });
  };

  return { create, getUserId, revoke };
};
