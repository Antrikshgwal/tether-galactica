import dotenv from "dotenv";
dotenv.config();
export class ZerionClient {
  private apiKey: string;
  private baseUrl = "https://api.zerion.io/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
        "X-Env": "testnet" // For fetching testnet data;
      },
    });

    if (!response.ok) {
      throw new Error(`Zerion API error: ${response.statusText}`);
    }

    return response.json();
  }

  // ==========================================
  // CORE METHODS
  // ==========================================

  /**
   * Get complete wallet portfolio across all supported chains
   */
  async getWalletPortfolio(address: string): Promise<ZerionPortfolio> {
    const data = await this.request<any>(
      `/wallets/${address}/portfolio/?currency=usd`,
    );

    return this.parsePortfolio(data);
  }

  /**
   * Get specific DeFi positions (Aave, Compound, etc.)
   */
  async getDeFiPositions(address: string): Promise<ZerionPosition[]> {
    const data = await this.request<any>(
      `/wallets/${address}/positions/?filter[positions]=only_deposited&currency=usd`,
    );

    return this.parsePositions(data);
  }

  /**
   * Get positions for a specific protocol (e.g., Aave V3)
   */
  async getProtocolPositions(
    address: string,
    protocol: string = "aave-v3",
  ): Promise<AavePosition[]> {
    const allPositions = await this.getDeFiPositions(address);

    return allPositions
      .filter((pos) => pos.protocol.toLowerCase().includes(protocol))
      .map((pos) => this.convertToAavePosition(pos));
  }

  /**
   * Get fungible token balances across all chains
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const data = await this.request<any>(
      `/wallets/${address}/positions/?filter[positions]=only_simple&currency=usd`,
    );

    return this.parseTokenBalances(data);
  }

  /**
   * Get portfolio breakdown by chain
   */
  async getPortfolioByChain(address: string): Promise<ChainBreakdown[]> {
    const portfolio = await this.getWalletPortfolio(address);
    const positions = await this.getDeFiPositions(address);

    // Group by chain
    const chainMap = new Map<string, ChainBreakdown>();

    positions.forEach((pos) => {
      const chain = pos.chain;
      if (!chainMap.has(chain)) {
        chainMap.set(chain, {
          chainName: chain,
          chainId: this.getChainId(chain),
          totalValue: 0,
          positions: [],
          tokens: [],
        });
      }

      const breakdown = chainMap.get(chain)!;
      breakdown.totalValue += pos.value;
      breakdown.positions.push(pos);
    });

    return Array.from(chainMap.values());
  }

  // ==========================================
  // PARSING HELPERS
  // ==========================================

  private parsePortfolio(data: any): ZerionPortfolio {
    return {
      totalValue: data.data.attributes.total.positions,
      totalChange24h: data.data.attributes.changes?.absolute_1d || 0,
      positions: data.data.attributes.positions_distribution_by_type || {},
      chains: data.data.attributes.positions_distribution_by_chain || {},
    };
  }

  private parsePositions(data: any): ZerionPosition[] {
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => {
      const attrs = item.attributes;
      const relationships = item.relationships;

      return {
        id: item.id,
        type: attrs.position_type,
        protocol: relationships?.dapp?.data?.id || "unknown",
        chain: relationships?.chain?.data?.id || "unknown",
        value: attrs.value || 0,
        quantity: attrs.quantity || {},
        fungibleInfo: relationships?.fungible_info?.data || null,
        // DeFi specific
        apy: attrs.apy || null,
        supplied: attrs.supplied || null,
        borrowed: attrs.borrowed || null,
        rewards: attrs.rewards || [],
      };
    });
  }

  private parseTokenBalances(data: any): TokenBalance[] {
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => {
      const attrs = item.attributes;
      const fungible = item.relationships?.fungible_info?.data;

      return {
        symbol: fungible?.attributes?.symbol || "UNKNOWN",
        name: fungible?.attributes?.name || "Unknown Token",
        address: fungible?.id || "",
        chain: item.relationships?.chain?.data?.id || "unknown",
        balance: attrs.quantity?.numeric || "0",
        value: attrs.value || 0,
        price: attrs.price || 0,
      };
    });
  }

  private convertToAavePosition(zerionPos: ZerionPosition): AavePosition {
    return {
      chainId: this.getChainId(zerionPos.chain),
      chainName: this.getChainName(zerionPos.chain),
      protocol: "Aave V3",
      asset: zerionPos.fungibleInfo?.attributes?.symbol || "USDT",
      supplied: BigInt(Math.floor((zerionPos.supplied || 0) * 1e6)), // Convert to wei
      value: zerionPos.value,
      apy: zerionPos.apy || 0,
      annualYield: (zerionPos.value * (zerionPos.apy || 0)) / 100,
    };
  }

  private getChainId(chainName: string): number {
    const chainMap: Record<string, number> = {
      ethereum: 1,
      arbitrum: 42161,
      base: 8453,
      polygon: 137,
      optimism: 10,
      avalanche: 43114,
      // Testnets
      sepolia: 11155111,
      "arbitrum-sepolia": 421614,
      "base-sepolia": 84532,
    };

    return chainMap[chainName.toLowerCase()] || 0;
  }

  private getChainName(chainId: string): string {
    const nameMap: Record<string, string> = {
      ethereum: "Ethereum",
      arbitrum: "Arbitrum",
      base: "Base",
      sepolia: "Ethereum Sepolia",
      "arbitrum-sepolia": "Arbitrum Sepolia",
      "base-sepolia": "Base Sepolia",
    };

    return nameMap[chainId.toLowerCase()] || chainId;
  }
}
