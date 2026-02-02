import type { PrismaClient } from "@prisma/client";
import type { DailyStatStatus, UserConfig } from "@molty/shared";

export type DailyStatRecord = {
  userId: number;
  username: string;
  totalSeconds: number;
  status: DailyStatStatus;
  error: string | null;
  fetchedAt: Date;
};

export type UserRepository = {
  countUsers: () => Promise<number>;
  listUsers: () => Promise<Array<{ id: number; wakawarsUsername: string; apiKey: string }>>;
  getUserById: (userId: number) => Promise<UserConfig | null>;
  getUserByUsername: (username: string) => Promise<UserConfig | null>;
  createUser: (config: { wakawarsUsername: string; apiKey: string }) => Promise<UserConfig>;
  updateUser: (
    userId: number,
    config: { wakawarsUsername: string; apiKey: string }
  ) => Promise<UserConfig>;
  setPassword: (userId: number, passwordHash: string | null) => Promise<UserConfig>;
  addFriendship: (userId: number, friendId: number) => Promise<UserConfig>;
  removeFriendship: (userId: number, friendId: number) => Promise<UserConfig>;
  searchUsers: (
    query: string,
    options?: { excludeUserId?: number; limit?: number }
  ) => Promise<Array<{ id: number; wakawarsUsername: string }>>;
  upsertDailyStat: (input: {
    userId: number;
    dateKey: string;
    totalSeconds: number;
    status: DailyStatStatus;
    error?: string | null;
    fetchedAt: Date;
  }) => Promise<void>;
  getDailyStats: (input: {
    userIds: number[];
    dateKey: string;
  }) => Promise<DailyStatRecord[]>;
};

type PrismaUser = {
  id: number;
  wakawars_username: string;
  api_key: string;
  password_hash: string | null;
  friendships: Array<{
    friend_id: number;
    friend: {
      id: number;
      wakawars_username: string;
      api_key: string;
    };
  }>;
};

const mapUserToConfig = (user: PrismaUser): UserConfig => ({
  id: user.id,
  wakawarsUsername: user.wakawars_username,
  apiKey: user.api_key,
  passwordHash: user.password_hash,
  friends: user.friendships.map((friendship) => ({
    id: friendship.friend_id,
    username: friendship.friend.wakawars_username,
    apiKey: friendship.friend.api_key || null
  }))
});

const userInclude = {
  friendships: {
    include: {
      friend: true
    }
  }
} as const;

export const createPrismaRepository = (prisma: PrismaClient): UserRepository => {
  const countUsers = async () => prisma.ww_user.count();

  const listUsers = async () => {
    const users = await prisma.ww_user.findMany({
      select: { id: true, wakawars_username: true, api_key: true }
    });

    return users.map((user) => ({
      id: user.id,
      wakawarsUsername: user.wakawars_username,
      apiKey: user.api_key
    }));
  };

  const getUserById = async (userId: number) => {
    const user = await prisma.ww_user.findUnique({
      where: { id: userId },
      include: userInclude
    });

    if (!user) {
      return null;
    }

    return mapUserToConfig(user as PrismaUser);
  };

  const getUserByUsername = async (username: string) => {
    const user = await prisma.ww_user.findUnique({
      where: { wakawars_username: username },
      include: userInclude
    });

    if (!user) {
      return null;
    }

    return mapUserToConfig(user as PrismaUser);
  };

  const createUser = async ({
    wakawarsUsername,
    apiKey
  }: {
    wakawarsUsername: string;
    apiKey: string;
  }) => {
    const user = await prisma.ww_user.create({
      data: {
        wakawars_username: wakawarsUsername,
        api_key: apiKey
      },
      include: userInclude
    });

    return mapUserToConfig(user as PrismaUser);
  };

  const updateUser = async (
    userId: number,
    {
      wakawarsUsername,
      apiKey
    }: {
      wakawarsUsername: string;
      apiKey: string;
    }
  ) => {
    const user = await prisma.ww_user.update({
      where: { id: userId },
      data: { wakawars_username: wakawarsUsername, api_key: apiKey },
      include: userInclude
    });

    return mapUserToConfig(user as PrismaUser);
  };

  const setPassword = async (userId: number, passwordHash: string | null) => {
    const user = await prisma.ww_user.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
      include: userInclude
    });

    return mapUserToConfig(user as PrismaUser);
  };

  const addFriendship = async (userId: number, friendId: number) => {
    if (userId !== friendId) {
      await prisma.ww_friendship.upsert({
        where: {
          user_id_friend_id: {
            user_id: userId,
            friend_id: friendId
          }
        },
        create: {
          user_id: userId,
          friend_id: friendId
        },
        update: {}
      });
    }

    const updated = await prisma.ww_user.findUnique({
      where: { id: userId },
      include: userInclude
    });

    return mapUserToConfig(updated as PrismaUser);
  };

  const removeFriendship = async (userId: number, friendId: number) => {
    await prisma.ww_friendship.deleteMany({
      where: {
        user_id: userId,
        friend_id: friendId
      }
    });

    const updated = await prisma.ww_user.findUnique({
      where: { id: userId },
      include: userInclude
    });

    return mapUserToConfig(updated as PrismaUser);
  };

  const searchUsers = async (
    query: string,
    options?: { excludeUserId?: number; limit?: number }
  ) => {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const users = await prisma.ww_user.findMany({
      where: {
        wakawars_username: {
          contains: normalized,
          mode: "insensitive"
        },
        ...(options?.excludeUserId ? { id: { not: options.excludeUserId } } : {})
      },
      take: options?.limit ?? 8,
      orderBy: { wakawars_username: "asc" }
    });

    return users.map((user) => ({
      id: user.id,
      wakawarsUsername: user.wakawars_username
    }));
  };

  const upsertDailyStat = async ({
    userId,
    dateKey,
    totalSeconds,
    status,
    error,
    fetchedAt
  }: {
    userId: number;
    dateKey: string;
    totalSeconds: number;
    status: DailyStatStatus;
    error?: string | null;
    fetchedAt: Date;
  }) => {
    await prisma.ww_daily_stat.upsert({
      where: {
        user_id_date_key: {
          user_id: userId,
          date_key: dateKey
        }
      },
      create: {
        user_id: userId,
        date_key: dateKey,
        total_seconds: totalSeconds,
        status,
        error: error ?? null,
        fetched_at: fetchedAt
      },
      update: {
        total_seconds: totalSeconds,
        status,
        error: error ?? null,
        fetched_at: fetchedAt
      }
    });
  };

  const getDailyStats = async ({
    userIds,
    dateKey
  }: {
    userIds: number[];
    dateKey: string;
  }): Promise<DailyStatRecord[]> => {
    if (userIds.length === 0) {
      return [];
    }

    const stats = await prisma.ww_daily_stat.findMany({
      where: {
        user_id: { in: userIds },
        date_key: dateKey
      },
      include: {
        user: {
          select: {
            id: true,
            wakawars_username: true
          }
        }
      }
    });

    return stats.map((stat) => ({
      userId: stat.user_id,
      username: stat.user.wakawars_username,
      totalSeconds: stat.total_seconds,
      status: stat.status as DailyStatStatus,
      error: stat.error ?? null,
      fetchedAt: stat.fetched_at
    }));
  };

  return {
    countUsers,
    listUsers,
    getUserById,
    getUserByUsername,
    createUser,
    updateUser,
    setPassword,
    addFriendship,
    removeFriendship,
    searchUsers,
    upsertDailyStat,
    getDailyStats
  };
};
