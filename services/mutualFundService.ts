export interface MfSearchResult {
  schemeCode: number;
  schemeName: string;
}

export interface MfNavData {
  date: string;
  nav: string;
}

export interface MfSchemeResponse {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
    isin_growth?: string;
    isin_div_reinvestment?: string;
  };
  data: MfNavData[];
  status: string;
}

class MutualFundService {
  private baseUrl = 'https://api.mfapi.in';

  async searchSchemes(query: string): Promise<MfSearchResult[]> {
    if (!query || query.length < 3) return [];
    try {
      const response = await fetch(`${this.baseUrl}/mf/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to fetch schemes');
      return await response.json();
    } catch (error) {
      console.error('MF Search Error:', error);
      return [];
    }
  }

  async getLatestNav(schemeCode: number): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseUrl}/mf/${schemeCode}/latest`);
      if (!response.ok) throw new Error('Failed to fetch latest NAV');
      const result: MfSchemeResponse = await response.json();
      if (result.status === 'SUCCESS' && result.data.length > 0) {
        return parseFloat(result.data[0].nav);
      }
      return null;
    } catch (error) {
      console.error(`MF Fetch NAV Error (${schemeCode}):`, error);
      return null;
    }
  }

  async getSchemeDetails(schemeCode: number): Promise<MfSchemeResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/mf/${schemeCode}`);
      if (!response.ok) throw new Error('Failed to fetch scheme details');
      return await response.json();
    } catch (error) {
      console.error(`MF Fetch Details Error (${schemeCode}):`, error);
      return null;
    }
  }
}

export const mutualFundService = new MutualFundService();
