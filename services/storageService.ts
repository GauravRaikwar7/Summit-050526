
export const storageService = {
  getItem: <T,>(key: string, defaultValue: T): T => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  },
  setItem: <T,>(key: string, value: T): void => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  },
  
  syncToCosmos: async (connectionString?: string, data?: unknown) => {
    try {
      const response = await fetch('/api/cosmos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString, data })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync with Cosmos DB');
      }
      return await response.json();
    } catch (error) {
      console.error("Cosmos DB Sync Error:", error);
      throw error;
    }
  },

  loadFromCosmos: async (connectionString?: string) => {
    try {
      const url = connectionString 
        ? `/api/cosmos/load?connectionString=${encodeURIComponent(connectionString)}`
        : `/api/cosmos/load`;
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load from Cosmos DB');
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Cosmos DB Load Error:", error);
      throw error;
    }
  },

  archiveCosmos: async (connectionString?: string) => {
    try {
      const response = await fetch('/api/cosmos/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive data from Cosmos DB');
      }
      return await response.json();
    } catch (error) {
      console.error("Cosmos DB Archive Error:", error);
      throw error;
    }
  },

  getRemoteConfig: async () => {
    try {
      const response = await fetch('/api/cosmos/config');
      if (!response.ok) return { hasServerConnectionString: false };
      return await response.json();
    } catch (error) {
      console.error("Error fetching remote config:", error);
      return { hasServerConnectionString: false };
    }
  }
};
    