export interface ZerionPortfolio {
  totalValue: number;
  totalChange24h: number;
  positions: Record<string, number>;
  chains: Record<string, number>;
}

export interface ZerionPosition {
  id: string;
  type: string;
  protocol: string;
  chain: string;
  value: number;
  quantity: any;
  fungibleInfo: any;
  // DeFi specific
  apy: number | null;
  supplied: number | null;
  borrowed: number | null;
  rewards: any[];
}

export interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  balance: string;
  value: number;
  price: number;
}

export interface AavePosition {
  chainId: number;
  chainName: string;
  protocol: string;
  asset: string;
  supplied: bigint;
  value: number;
  apy: number;
  annualYield: number;
}

export interface ChainBreakdown {
  chainName: string;
  chainId: number;
  totalValue: number;
  positions: ZerionPosition[];
  tokens: TokenBalance[];
}
