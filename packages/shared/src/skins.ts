export const DAILY_RANK_REWARD_COINS: Record<1 | 2 | 3, number> = {
  1: 3,
  2: 2,
  3: 1
};

export const MIN_SKIN_PRICE_COINS = 10;

export const getDailyRankRewardCoins = (rank: number | null | undefined): number => {
  if (rank === 1 || rank === 2 || rank === 3) {
    return DAILY_RANK_REWARD_COINS[rank];
  }

  return 0;
};
