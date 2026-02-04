export type Friend = {
  id: number;
  username: string; // WakaWars username (assumed to match WakaTime username)
  apiKey?: string | null;
};

export type FriendPublic = {
  username: string;
};

export type StatsVisibility = "everyone" | "friends" | "no_one";

export type GroupMember = {
  id: number;
  username: string;
};

export type Group = {
  id: number;
  name: string;
  members: GroupMember[];
};

export type UserConfig = {
  id: number;
  wakawarsUsername: string;
  apiKey: string;
  wakatimeTimezone?: string | null;
  friends: Friend[];
  groups: Group[];
  statsVisibility: StatsVisibility;
  passwordHash?: string | null;
};

export type PublicConfig = {
  wakawarsUsername: string;
  friends: FriendPublic[];
  groups: Group[];
  statsVisibility: StatsVisibility;
  hasApiKey: boolean;
  passwordSet: boolean;
};

export type DailyStatStatus = "ok" | "private" | "not_found" | "error";

export type DailyStat = {
  username: string; // WakaWars username
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

export type WeeklyStat = {
  username: string; // WakaWars username
  totalSeconds: number;
  dailyAverageSeconds: number;
  status: DailyStatStatus;
  error?: string | null;
};

export type WeeklyLeaderboardEntry = WeeklyStat & {
  rank: number | null;
  deltaSeconds: number;
};

export type WeeklyLeaderboardResponse = {
  range: string;
  updatedAt: string;
  entries: WeeklyLeaderboardEntry[];
};
