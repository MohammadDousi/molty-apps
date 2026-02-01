export type Friend = {
  username: string;
  apiKey?: string | null;
};

export type FriendPublic = {
  username: string;
};

export type UserConfig = {
  username: string;
  apiKey: string;
  friends: Friend[];
};

export type PublicConfig = {
  username: string;
  friends: FriendPublic[];
  hasApiKey: boolean;
};

export type DailyStatStatus = "ok" | "private" | "not_found" | "error";

export type DailyStat = {
  username: string;
  totalSeconds: number;
  status: DailyStatStatus;
  error?: string | null;
};

export type LeaderboardEntry = DailyStat & {
  rank: number | null;
  deltaSeconds: number;
};

export type LeaderboardResponse = {
  date: string;
  updatedAt: string;
  entries: LeaderboardEntry[];
};
