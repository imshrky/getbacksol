export type MockToken = {
  symbol: string;
  name: string;
  balance: number;
  icon: string; // tailwind gradient classes stand in for a real token logo
};

export const MOCK_TOKENS: MockToken[] = [
  { symbol: "SOL", name: "Solana", balance: 12.4821, icon: "from-purple-400 to-cyan-300" },
  { symbol: "NEBU", name: "Nebula Coin", balance: 452000, icon: "from-pink-400 to-purple-500" },
  { symbol: "USDC", name: "USD Coin", balance: 890.12, icon: "from-blue-400 to-blue-600" },
  { symbol: "FLOKI", name: "Floki Test", balance: 1250000, icon: "from-orange-400 to-yellow-300" },
];

export const MOCK_POOLS = [
  { pair: "NEBU / SOL", myLiquidity: "1,204.55 LP", share: "0.42%", tvl: "$182,400" },
  { pair: "FLOKI / SOL", myLiquidity: "88.10 LP", share: "0.05%", tvl: "$54,120" },
];

export const MOCK_LEADERBOARD = [
  { rank: 1, wallet: "8f3K...c92A", burned: "12,400,000 NEBU", volume: "$48,220" },
  { rank: 2, wallet: "3nQz...81pL", burned: "9,880,500 FLOKI", volume: "$31,940" },
  { rank: 3, wallet: "7uYt...45zX", burned: "6,120,000 NEBU", volume: "$22,105" },
  { rank: 4, wallet: "1wCe...09mR", burned: "4,900,320 USDC-LP", volume: "$18,760" },
  { rank: 5, wallet: "5vBn...77qT", burned: "3,410,000 FLOKI", volume: "$12,330" },
];

export type MockRentAccount = {
  id: string;
  mint: string;
  symbol: string;
  status: "empty" | "dust";
  dustAmount?: string;
  reclaimable: number; // SOL returned when the account is closed
};

// A standard SPL token account locks ~0.00203928 SOL as rent-exempt reserve.
export const RENT_PER_ACCOUNT = 0.00203928;

export const MOCK_RENT_ACCOUNTS: MockRentAccount[] = [
  { id: "1", mint: "7xKX...p2Qa", symbol: "USDC-old", status: "empty", reclaimable: RENT_PER_ACCOUNT },
  { id: "2", mint: "3nRt...9fZc", symbol: "MEMEX", status: "dust", dustAmount: "0.000004", reclaimable: RENT_PER_ACCOUNT },
  { id: "3", mint: "9pLm...c81V", symbol: "SAMO", status: "empty", reclaimable: RENT_PER_ACCOUNT },
  { id: "4", mint: "2vBn...44qT", symbol: "RUGCOIN", status: "dust", dustAmount: "0.0000001", reclaimable: RENT_PER_ACCOUNT },
  { id: "5", mint: "5wCe...19mR", symbol: "TESTV1", status: "empty", reclaimable: RENT_PER_ACCOUNT },
  { id: "6", mint: "8f3K...c92A", symbol: "OLDLP", status: "empty", reclaimable: RENT_PER_ACCOUNT },
  { id: "7", mint: "1uYt...05zX", symbol: "AIRDROP7", status: "dust", dustAmount: "0.00000002", reclaimable: RENT_PER_ACCOUNT },
];

export const RECLAIM_FEE_RATE = 0.15;
