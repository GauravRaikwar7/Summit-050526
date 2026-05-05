
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { EMI, Saving, Account, AccountType, Transaction, Investment, CurrencyCode, AppSettings, PdfParserType, RawTransaction, TransactionType, StorageMode, GlobalErrorInfo } from './types';
import { storageService } from './services/storageService';
import { APP_NAME, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, STORAGE_KEYS, AZURE_CONFIG_INFO } from './constants';
import { HomeIcon, WalletIcon, ArrowPathIcon, ChartPieIcon, Cog6ToothIcon, ReceiptRefundIcon, CreditCardIcon, DocumentArrowDownIcon, Bars3Icon, XMarkIcon } from './components/icons';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import InvestmentsPage from './pages/InvestmentsPage';
import EMIPage from './pages/EMIPage';
import SavingsPage from './pages/SavingsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ExpensesPage from './pages/ExpensesPage';
import { documentParserService } from './services/documentParserService';
import { mutualFundService } from './services/mutualFundService';
import ErrorModal from './components/ErrorModal';

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string; suffix?: React.ReactNode; onClick?: () => void }> = ({ to, icon, label, suffix, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (location.pathname === '/' && (to === '/dashboard' || to === '/'));
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200
                  ${isActive ? 'bg-primary text-white shadow-lg' : 'hover:bg-surface hover:text-text-primary text-text-secondary'}`}
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {suffix}
    </Link>
  );
};

const App: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [emis, setEmis] = useState<EMI[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [appSettings, setAppSettings] = useState<AppSettings>(
    storageService.getItem<AppSettings>(STORAGE_KEYS.APP_SETTINGS, {
      selectedPdfParser: PdfParserType.AZURE, 
      azureDocIntelEndpoint: '',
      azureDocIntelKey: '',
      globalDisplayCurrency: DEFAULT_CURRENCY,
      storageMode: StorageMode.LOCAL,
      trackingFrequency: 'once'
    })
  );

  const [globalDisplayCurrency, setGlobalDisplayCurrency] = useState<CurrencyCode>(
    storageService.getItem(STORAGE_KEYS.GLOBAL_DISPLAY_CURRENCY, DEFAULT_CURRENCY)
  );

  const [globalError, setGlobalError] = useState<GlobalErrorInfo | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const prevStorageModeRef = useRef<StorageMode>(appSettings.storageMode);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const loadData = useCallback(async (connectionString?: string) => {
    try {
      console.log("loadData initiated...", connectionString ? "With CS" : "With Env/Config");
      const config = await storageService.getRemoteConfig();
      const isConfigured = !!connectionString || config.hasServerConnectionString;
      
      if (isConfigured) {
        const remoteData = await storageService.loadFromCosmos(connectionString);
        console.log("Remote data fetch result:", remoteData ? "Data Found" : "No Data");
        
        if (remoteData) {
          if (remoteData.accounts) {
            console.log(`Setting ${remoteData.accounts.length} accounts from remote`);
            setAccounts(remoteData.accounts);
          }
          if (remoteData.transactions) {
            console.log(`Setting ${remoteData.transactions.length} transactions from remote`);
            setTransactions(remoteData.transactions);
          }
          if (remoteData.investments) setInvestments(remoteData.investments);
          if (remoteData.emis) setEmis(remoteData.emis);
          if (remoteData.savings) setSavings(remoteData.savings);
          
          if (remoteData.appSettings) {
             setAppSettings(prev => {
                const updated = {
                  ...prev, 
                  ...remoteData.appSettings, 
                  // Keep CURRENT storage mode and connection string if they are already set locally 
                  // to avoid pulling remote "LOCAL" mode and accidentally disconnecting.
                  storageMode: prev.storageMode,
                  cosmosConnectionString: connectionString || prev.cosmosConnectionString
                };
                storageService.setItem(STORAGE_KEYS.APP_SETTINGS, updated);
                return updated;
             });
          }
          if (remoteData.globalDisplayCurrency) setGlobalDisplayCurrency(remoteData.globalDisplayCurrency);
          return true;
        } else {
          console.warn("loadData: remoteData is null or empty object");
        }
      } else {
        console.log("loadData skipped: Not configured (no CS and no server env var)");
      }
    } catch (error) {
      console.error("Data load error:", error);
      setGlobalError({
        title: "Cloud Data Load Failed",
        message: "Failed to load data from Azure Cosmos DB. Please check your connection string and network connectivity.",
        technicalDetails: error instanceof Error ? error.message : String(error),
        type: 'error'
      });
    }
    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      // Load from local first
      const localAccounts = storageService.getItem<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const localTransactions = storageService.getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      const localInvestments = storageService.getItem<Investment[]>(STORAGE_KEYS.INVESTMENTS, []);
      const localEmis = storageService.getItem<EMI[]>(STORAGE_KEYS.EMIS, []);
      const localSavings = storageService.getItem<Saving[]>(STORAGE_KEYS.SAVINGS, []);
      
      setAccounts(localAccounts);
      setTransactions(localTransactions);
      setInvestments(localInvestments);
      setEmis(localEmis);
      setSavings(localSavings);
      
      // Try to load from Cosmos regardless of local appSettings (server might have env var set statically)
      // but only if connection string is present or we are in COSMOS mode or it's first boot
      const config = await storageService.getRemoteConfig();
      if (appSettings.storageMode === StorageMode.COSMOS || config.hasServerConnectionString || appSettings.cosmosConnectionString) {
        await loadData(appSettings.cosmosConnectionString);
      }

      documentParserService.configure(appSettings);
      setIsLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Sync Data to LocalStorage (only if in LOCAL mode)
  useEffect(() => {
    if (!isLoading && appSettings.storageMode === StorageMode.LOCAL) {
      storageService.setItem(STORAGE_KEYS.ACCOUNTS, accounts);
      storageService.setItem(STORAGE_KEYS.TRANSACTIONS, transactions);
      storageService.setItem(STORAGE_KEYS.INVESTMENTS, investments);
      storageService.setItem(STORAGE_KEYS.EMIS, emis);
      storageService.setItem(STORAGE_KEYS.SAVINGS, savings);
    }
  }, [accounts, transactions, investments, emis, savings, appSettings.storageMode, isLoading]);

  const handleManualPushToCosmos = async (connectionStringOverride?: string) => {
    const config = await storageService.getRemoteConfig();
    const cs = connectionStringOverride || appSettings.cosmosConnectionString;

    if (cs || config.hasServerConnectionString) {
      await storageService.syncToCosmos(cs, {
        accounts,
        transactions,
        investments,
        emis,
        savings,
        appSettings,
        globalDisplayCurrency
      });
      return true;
    }
    throw new Error("Cosmos DB is not configured.");
  };

  // Auto-sync to Cosmos (with debounce)
  useEffect(() => {
    if (isLoading || appSettings.storageMode !== StorageMode.COSMOS) {
      prevStorageModeRef.current = appSettings.storageMode;
      return;
    }

    // If we just switched to COSMOS mode, don't trigger an automatic push immediately.
    // This prevents syncing local data over remote data right after switching.
    if (prevStorageModeRef.current !== StorageMode.COSMOS) {
      prevStorageModeRef.current = StorageMode.COSMOS;
      return;
    }

    const timer = setTimeout(() => {
      handleManualPushToCosmos().catch(err => {
        console.error("Auto-sync to Cosmos failed:", err);
      });
    }, 5000); // 5 second debounce for cloud sync

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, investments, emis, savings, appSettings.storageMode, globalDisplayCurrency]);

  const handleManualPullFromCosmos = async (connectionStringOverride?: string) => {
    return await loadData(connectionStringOverride || appSettings.cosmosConnectionString);
  };

  const handleWipeLocalData = () => {
    // Clear state
    setAccounts([]);
    setTransactions([]);
    setInvestments([]);
    setEmis([]);
    setSavings([]);
    
    // Clear ALL persistence
    storageService.removeItem(STORAGE_KEYS.ACCOUNTS);
    storageService.removeItem(STORAGE_KEYS.TRANSACTIONS);
    storageService.removeItem(STORAGE_KEYS.INVESTMENTS);
    storageService.removeItem(STORAGE_KEYS.EMIS);
    storageService.removeItem(STORAGE_KEYS.SAVINGS);
    
    // Optionally we could reset settings too, but usually users want to keep their connection strings/API keys
    // unless they strictly want a factory reset. For now we keep settings.
    
    console.log("Local data storage wiped.");
    
    // If we are in COSMOS mode, reload from cloud after wiping local cache
    if (appSettings.storageMode === StorageMode.COSMOS) {
      loadData(appSettings.cosmosConnectionString);
    }
  };

  const handleArchiveCosmosData = async () => {
    const config = await storageService.getRemoteConfig();
    if (appSettings.cosmosConnectionString || config.hasServerConnectionString) {
       await storageService.archiveCosmos(appSettings.cosmosConnectionString);
       // After archiving (which clears cloud), we should also clear local to start fresh
       handleWipeLocalData();
       return true;
    }
    throw new Error("Cosmos DB is not configured.");
  };

  const handleSaveAppSettings = async (newSettings: AppSettings) => {
    const modeChanged = appSettings.storageMode !== newSettings.storageMode;
    const csChanged = appSettings.cosmosConnectionString !== newSettings.cosmosConnectionString;
    
    setAppSettings(newSettings);
    storageService.setItem(STORAGE_KEYS.APP_SETTINGS, newSettings);
    documentParserService.configure(newSettings);

    if (modeChanged || (newSettings.storageMode === StorageMode.COSMOS && csChanged)) {
      if (newSettings.storageMode === StorageMode.COSMOS) {
        await loadData(newSettings.cosmosConnectionString);
      } else {
        // Switching back to local: load what's in local storage
        const localAccounts = storageService.getItem<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
        const localTransactions = storageService.getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
        const localInvestments = storageService.getItem<Investment[]>(STORAGE_KEYS.INVESTMENTS, []);
        const localEmis = storageService.getItem<EMI[]>(STORAGE_KEYS.EMIS, []);
        const localSavings = storageService.getItem<Saving[]>(STORAGE_KEYS.SAVINGS, []);
        
        setAccounts(localAccounts);
        setTransactions(localTransactions);
        setInvestments(localInvestments);
        setEmis(localEmis);
        setSavings(localSavings);
      }
    } else if (newSettings.storageMode === StorageMode.COSMOS) {
       // Just settings changed, push them to Cosmos
       handleManualPushToCosmos(newSettings.cosmosConnectionString);
    }
  };

  const handleGlobalCurrencyChange = (newCurrency: CurrencyCode) => {
    setGlobalDisplayCurrency(newCurrency);
    storageService.setItem(STORAGE_KEYS.GLOBAL_DISPLAY_CURRENCY, newCurrency);
  };

  const refreshInvestmentPrices = useCallback(async () => {
    if (appSettings.trackingFrequency === 'none') return;
    
    console.log("Starting automated investment price refresh...");
    let updatedCount = 0;
    
    // We update investments that have a schemeCode
    const updatedInvestments = await Promise.all(investments.map(async (inv) => {
      if (inv.schemeCode) {
        const latestNav = await mutualFundService.getLatestNav(inv.schemeCode);
        if (latestNav !== null && latestNav !== inv.currentPrice) {
          updatedCount++;
          return { ...inv, currentPrice: latestNav };
        }
      }
      return inv;
    }));

    if (updatedCount > 0) {
      setInvestments(updatedInvestments);
      const now = new Date().toISOString();
      setAppSettings(prev => {
        const updated = { ...prev, lastValuesUpdate: now };
        storageService.setItem(STORAGE_KEYS.APP_SETTINGS, updated);
        return updated;
      });
      console.log(`Successfully refreshed ${updatedCount} investment prices.`);
    } else {
      console.log("No price changes found or no trackable investments.");
    }
  }, [investments, appSettings.trackingFrequency]);

  // Handle Automated Tracking Schedule
  useEffect(() => {
    if (isLoading || appSettings.trackingFrequency === 'none') return;

    const checkRefresh = () => {
      const lastUpdate = appSettings.lastValuesUpdate ? new Date(appSettings.lastValuesUpdate) : new Date(0);
      const now = new Date();
      const diffMs = now.getTime() - lastUpdate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let shouldRefresh = false;
      if (appSettings.trackingFrequency === 'once') {
        shouldRefresh = diffHours >= 24;
      } else if (appSettings.trackingFrequency === 'thrice') {
        shouldRefresh = diffHours >= 8;
      }

      if (shouldRefresh) {
        refreshInvestmentPrices();
      }
    };

    // Check on mount and then every hour while app is open
    checkRefresh();
    const interval = setInterval(checkRefresh, 60 * 60 * 1000); 
    
    return () => clearInterval(interval);
  }, [isLoading, appSettings.trackingFrequency, appSettings.lastValuesUpdate, refreshInvestmentPrices]);

  const addAccount = useCallback((account: Omit<Account, 'id' | 'createdAt'>) => {
    const newAccount: Account = {
      ...account,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setAccounts(prev => [...prev, newAccount]);
  }, []);

  const updateAccount = useCallback((updatedAccount: Account) => {
    setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
  }, []);
  
  const deleteAccount = useCallback((accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    setTransactions(prev => prev.filter(tx => tx.accountId !== accountId));
    setInvestments(prev => prev.filter(inv => inv.accountId !== accountId));
  }, []);

  const batchAddTransactions = useCallback((newTransactions: (RawTransaction & { accountId: string })[], forcedBalance?: number, balanceDate?: string) => {
    setTransactions(prev => {
      const existingTxMap = new Set(prev.map(tx => 
        `${tx.accountId}-${tx.date}-${tx.description}-${tx.amount}-${tx.type}`
      ));

      const uniqueNewTxs: Transaction[] = [];

      newTransactions.forEach(tx => {
        const key = `${tx.accountId}-${tx.date}-${tx.description}-${tx.amount}-${tx.type}`;
        if (!existingTxMap.has(key)) {
          const newTx: Transaction = { 
            ...tx, 
            id: crypto.randomUUID(),
            friendlyDescription: tx.friendlyDescription || tx.description
          };
          uniqueNewTxs.push(newTx);
          existingTxMap.add(key);
        }
      });

      // Update account balance
        if (newTransactions.length > 0) {
        const accountId = newTransactions[0].accountId;
        const account = accounts.find(acc => acc.id === accountId);
        if (account) {
          // If a forced balance is provided, we should check if it's the LATEST balance
          // The user wants: April (1000) then May (900) -> balance is 900
          // If we upload May first (900) then April (1000), we should probably KEEP 900 if May is newer.
          
          const latestNewDate = newTransactions.length > 0 
            ? newTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, newTransactions[0].date)
            : undefined;
          
          const effectiveBalanceDate = balanceDate || latestNewDate;
          const isMoreRecent = !account.lastUpdatedDate || (effectiveBalanceDate && effectiveBalanceDate >= account.lastUpdatedDate);

          if (forcedBalance !== undefined && isMoreRecent) {
            updateAccount({ 
              ...account, 
              balance: forcedBalance, 
              lastUpdatedDate: effectiveBalanceDate 
            });
          } else if (uniqueNewTxs.length > 0) {
            // Only adjust current balance incrementally for transactions occurring AFTER the last established balance date.
            // Past transactions are added to history but don't move the 'current' balance derived from a newer statement.
            const accountBalanceAdjustment = uniqueNewTxs
              .filter(tx => !account.lastUpdatedDate || tx.date > account.lastUpdatedDate)
              .reduce((sum, tx) => {
                const val = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
                const total = (account.type === AccountType.LOAN || account.type === AccountType.CREDIT_CARD) ? -val : val;
                return sum + total;
              }, 0);

            if (accountBalanceAdjustment !== 0 || (latestNewDate && (!account.lastUpdatedDate || latestNewDate > account.lastUpdatedDate))) {
              const newBalance = account.balance + accountBalanceAdjustment;
              const newDate = (latestNewDate && (!account.lastUpdatedDate || latestNewDate > account.lastUpdatedDate))
                ? latestNewDate
                : account.lastUpdatedDate;

              updateAccount({ 
                ...account, 
                balance: newBalance,
                lastUpdatedDate: newDate
              });
            }
          }
        }
      }

      if (uniqueNewTxs.length === 0) return prev;

      const combined = [...uniqueNewTxs, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return combined;
    });
  }, [accounts, updateAccount]);

  const addTransaction = useCallback((transaction: RawTransaction & { accountId: string }) => {
    batchAddTransactions([transaction]);
  }, [batchAddTransactions]);

  const deleteTransaction = useCallback((transactionId: string) => {
    const transactionToDelete = transactions.find(tx => tx.id === transactionId);
    if (!transactionToDelete) return;

    setTransactions(prev => prev.filter(tx => tx.id !== transactionId));

    const account = accounts.find(acc => acc.id === transactionToDelete.accountId);
    if (account) {
      const isLiability = account.type === AccountType.LOAN || account.type === AccountType.CREDIT_CARD;
      const val = transactionToDelete.type === TransactionType.INCOME ? transactionToDelete.amount : -transactionToDelete.amount;
      const totalAdjustment = isLiability ? -val : val;
      
    // We are deleting, so we reverse the adjustment
      const newBalance = account.balance - totalAdjustment;
      
      // Recalculate last updated date
      const remainingTransactions = transactions.filter(tx => tx.accountId === transactionToDelete.accountId && tx.id !== transactionId);
      const latestDate = remainingTransactions.length > 0 
        ? remainingTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, remainingTransactions[0].date)
        : account.createdAt; // Fallback to created date if no transactions left

      updateAccount({ 
        ...account, 
        balance: newBalance,
        lastUpdatedDate: latestDate
      });
    }
  }, [transactions, accounts, updateAccount]);

  const updateTransaction = useCallback((updatedTx: Transaction) => {
    setTransactions(prev => {
      const oldTx = prev.find(tx => tx.id === updatedTx.id);
      if (!oldTx) return prev;

      // Adjust account balance if amount or type changed (assuming accountId doesn't change for now)
      const account = accounts.find(acc => acc.id === updatedTx.accountId);
      if (account) {
        const isLiability = account.type === AccountType.LOAN || account.type === AccountType.CREDIT_CARD;
        
        let balanceAdjustment = 0;
        
        // Remove old impact
        const oldVal = oldTx.type === TransactionType.INCOME ? oldTx.amount : -oldTx.amount;
        balanceAdjustment -= (isLiability ? -oldVal : oldVal);
        
        // Add new impact
        const newVal = updatedTx.type === TransactionType.INCOME ? updatedTx.amount : -updatedTx.amount;
        balanceAdjustment += (isLiability ? -newVal : newVal);
        
        if (balanceAdjustment !== 0) {
          // Recalculate latest date after update
          const accountTransactions = prev.filter(tx => tx.accountId === updatedTx.accountId);
          const latestDate = accountTransactions.length > 0 
            ? accountTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, accountTransactions[0].date)
            : account.createdAt;

          updateAccount({ 
            ...account, 
            balance: account.balance + balanceAdjustment,
            lastUpdatedDate: latestDate > (account.lastUpdatedDate || '') ? latestDate : account.lastUpdatedDate
          });
        }
      }

      return prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx);
    });
  }, [accounts, updateAccount]);


  const addInvestment = useCallback((investment: Omit<Investment, 'id'>) => {
    const newInvestment: Investment = { ...investment, id: crypto.randomUUID() };
    setInvestments(prev => [...prev, newInvestment].sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()));

    // 1. Always record the deduction from the funding account (Regular Account)
    if (investment.fundingAccountId && investment.purchasePrice * investment.quantity > 0) {
      addTransaction({
        accountId: investment.fundingAccountId,
        date: investment.purchaseDate,
        description: `Investment Purchase: ${investment.name}`,
        amount: investment.purchasePrice * investment.quantity,
        type: TransactionType.INVESTMENT,
        category: 'Investment',
        referenceId: newInvestment.id
      });
    }

    // 2. We do NOT automatically update the "holding" account balance here 
    // because the Dashboard sums 'investments' separately from 'account balances'.
    // Adding it to both would result in double counting the asset value.
  }, [addTransaction]);

  const updateInvestment = useCallback((updatedInvestment: Investment) => {
    setInvestments(prev => prev.map(inv => inv.id === updatedInvestment.id ? updatedInvestment : inv));
  }, []);

  const recordInvestmentValuation = useCallback((investmentId: string, currentPrice: number) => {
    setInvestments(prev => prev.map(inv => 
      inv.id === investmentId ? { ...inv, currentPrice } : inv
    ));
  }, []);

  const deleteInvestment = useCallback((investmentId: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== investmentId));
  }, []);

  const addEMI = useCallback((emi: Omit<EMI, 'id'>) => {
    const newEMI: EMI = { ...emi, id: crypto.randomUUID() };
    setEmis(prev => [...prev, newEMI]);

    if (emi.lastPaidDate && emi.lastPaidAmount && emi.lastPaidAmount > 0) {
      // Record Transaction
      addTransaction({
        accountId: emi.accountId,
        date: emi.lastPaidDate,
        description: `EMI Payment: ${emi.name}`,
        amount: emi.lastPaidAmount,
        type: TransactionType.EMI,
        category: emi.category || 'EMI',
        referenceId: newEMI.id
      });

      // Record Principal Repayment on Loan Account if applicable
      if (emi.loanAccountId) {
        addTransaction({
          accountId: emi.loanAccountId,
          date: emi.lastPaidDate,
          description: `Principal Repayment: ${emi.name}`,
          amount: emi.lastPaidAmount, // Simplified: assumption total reduces balance for now or handled by user
          type: TransactionType.INCOME, // Income reduces liability
          category: emi.category || 'EMI',
          referenceId: newEMI.id
        });
      }
    }
  }, [addTransaction]);

  const recordEmiPayment = useCallback((emiId: string, date: string, amount: number) => {
    setEmis(prev => {
      const emi = prev.find(e => e.id === emiId);
      if (!emi) return prev;

      // Record Transaction
      addTransaction({
        accountId: emi.accountId,
        date: date,
        description: `EMI Payment: ${emi.name}`,
        amount: amount,
        type: TransactionType.EMI,
        category: emi.category || 'EMI',
        referenceId: emiId
      });

      // Update Loan account if applicable
      if (emi.loanAccountId) {
        addTransaction({
          accountId: emi.loanAccountId,
          date: date,
          description: `Principal Repayment: ${emi.name}`,
          amount: amount,
          type: TransactionType.INCOME,
          category: emi.category || 'EMI',
          referenceId: emiId
        });
      }

      return prev.map(e => e.id === emiId ? { 
        ...e, 
        lastPaidDate: date, 
        lastPaidAmount: amount 
      } : e);
    });
  }, [addTransaction]);

  const batchAddEMIs = useCallback((newEMIs: Omit<EMI, 'id'>[]) => {
    newEMIs.forEach(emi => addEMI(emi));
  }, [addEMI]);

  const deleteEMI = useCallback((emiId: string) => {
    setEmis(prev => prev.filter(emi => emi.id !== emiId));
  }, []);

  const recordInvestmentPayment = useCallback((investmentId: string, date: string, amount: number, unitPrice?: number) => {
    setInvestments(prev => {
      const inv = prev.find(i => i.id === investmentId);
      if (!inv) return prev;

      const price = unitPrice || inv.currentPrice || inv.purchasePrice;
      const newUnits = amount / price;
      const totalQuantity = inv.quantity + newUnits;
      // Update average cost: (Old Qty * Old Avg) + (New Qty * New Price) / Total Qty
      const newAvgPrice = ((inv.quantity * inv.purchasePrice) + (newUnits * price)) / totalQuantity;

      // Record Transaction
      addTransaction({
        accountId: inv.fundingAccountId || inv.accountId || '',
        date: date,
        description: `Investment Payment: ${inv.name}`,
        amount: amount,
        type: inv.mode === 'SIP' ? TransactionType.SIP : TransactionType.INVESTMENT,
        category: 'Investment',
        referenceId: investmentId
      });

      return prev.map(i => i.id === investmentId ? {
        ...i,
        quantity: totalQuantity,
        purchasePrice: newAvgPrice,
        currentPrice: price > 0 ? price : i.currentPrice,
        lastPaidDate: date,
        lastPaidAmount: amount
      } : i);
    });
  }, [addTransaction]);

  const addSaving = useCallback((saving: Omit<Saving, 'id'>) => {
    const newSaving: Saving = { ...saving, id: crypto.randomUUID() };
    setSavings(prev => [...prev, newSaving].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    if (saving.paidDate && saving.paidAmount && saving.paidAmount > 0 && saving.accountId) {
      addTransaction({
        accountId: saving.accountId,
        date: saving.paidDate,
        description: `Saving Recorded: ${saving.name}`,
        amount: saving.paidAmount,
        type: TransactionType.EXPENSE,
        category: 'Savings',
        referenceId: newSaving.id
      });
    }
  }, [addTransaction]);

  const batchAddSavings = useCallback((newSavings: Omit<Saving, 'id'>[]) => {
    newSavings.forEach(saving => addSaving(saving));
  }, [addSaving]);

  const deleteSaving = useCallback((savingId: string) => {
    setSavings(prev => prev.filter(s => s.id !== savingId));
  }, []);


  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return (
    <HashRouter>
      <div className="flex h-screen bg-background overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-800 p-6 space-y-6 border-r border-slate-700 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between lg:justify-start">
            <div className="text-2xl font-bold text-primary flex items-center">
              <ChartPieIcon className="w-8 h-8 mr-2" />
              {APP_NAME}
            </div>
            <button onClick={closeSidebar} className="lg:hidden text-text-secondary hover:text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="space-y-2 flex-1 overflow-y-auto">
            <NavLink to="/dashboard" icon={<HomeIcon />} label="Dashboard" onClick={closeSidebar} />
            <NavLink to="/accounts" icon={<WalletIcon />} label="Accounts" onClick={closeSidebar} />
            <NavLink to="/transactions" icon={<ArrowPathIcon />} label="Transactions" onClick={closeSidebar} />
            <NavLink to="/expenses" icon={<ReceiptRefundIcon />} label="Expenses" onClick={closeSidebar} />
            <NavLink to="/investments" icon={<ChartPieIcon />} label="Investments" onClick={closeSidebar} />
            <NavLink to="/emis" icon={<CreditCardIcon />} label="EMIs" onClick={closeSidebar} />
            <NavLink to="/savings" icon={<ChartPieIcon />} label="Savings" onClick={closeSidebar} />
            <NavLink to="/reports" icon={<DocumentArrowDownIcon />} label="Reports" onClick={closeSidebar} />
            <NavLink 
              to="/settings" 
              icon={<Cog6ToothIcon />} 
              label="Settings"
              onClick={closeSidebar}
              suffix={
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider
                                 ${appSettings.storageMode === StorageMode.COSMOS 
                                   ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                   : 'bg-slate-600/50 text-slate-400 border border-slate-500/30'}`}>
                  {appSettings.storageMode === StorageMode.COSMOS ? 'Cosmos' : 'Local'}
                </span>
              }
            />
          </nav>

          <div className="mt-auto space-y-4 pt-4 border-t border-slate-700">
            <div>
              <p className="text-xs text-text-secondary mb-2 uppercase font-bold tracking-widest opacity-50">Currency</p>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_CURRENCIES.map(curr => (
                  <button
                    key={curr}
                    onClick={() => handleGlobalCurrencyChange(curr)}
                    className={`px-3 py-2 text-xs rounded-md font-medium transition-all
                                ${globalDisplayCurrency === curr
                                  ? 'bg-primary text-white shadow-md'
                                  : 'bg-slate-700 hover:bg-slate-600 text-text-secondary'}`}
                    aria-pressed={globalDisplayCurrency === curr}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
             {appSettings.selectedPdfParser === PdfParserType.AZURE && !documentParserService.isConfigured(PdfParserType.AZURE) && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-[10px] leading-relaxed text-yellow-200">
                    {AZURE_CONFIG_INFO}
                </div>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Top Bar */}
          <header className="lg:hidden flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 z-30">
            <button onClick={toggleSidebar} className="p-2 text-text-secondary hover:text-white transition-colors">
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div className="text-xl font-bold text-primary flex items-center ml-2">
              <ChartPieIcon className="w-6 h-6 mr-2" />
              {APP_NAME}
            </div>
            <div className="w-10" /> {/* Spacer */}
          </header>

          <main className="flex-1 p-4 md:p-10 overflow-y-auto">
            <Routes>
            <Route path="/" element={<DashboardPage accounts={accounts} transactions={transactions} investments={investments} savings={savings} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/dashboard" element={<DashboardPage accounts={accounts} transactions={transactions} investments={investments} savings={savings} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/accounts" element={<AccountsPage accounts={accounts} transactions={transactions} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/transactions" element={<TransactionsPage transactions={transactions} addTransaction={addTransaction} batchAddTransactions={batchAddTransactions} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} accounts={accounts} onError={(err) => setGlobalError(err)} />} />
            <Route path="/expenses" element={<ExpensesPage transactions={transactions} accounts={accounts} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/investments" element={<InvestmentsPage investments={investments} addInvestment={addInvestment} updateInvestment={updateInvestment} deleteInvestment={deleteInvestment} recordInvestmentValuation={recordInvestmentValuation} recordInvestmentPayment={recordInvestmentPayment} accounts={accounts} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/emis" element={<EMIPage emis={emis} addEMI={addEMI} batchAddEMIs={batchAddEMIs} deleteEMI={deleteEMI} recordEmiPayment={recordEmiPayment} accounts={accounts} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/savings" element={<SavingsPage savings={savings} addSaving={addSaving} batchAddSavings={batchAddSavings} deleteSaving={deleteSaving} transactions={transactions} accounts={accounts} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/reports" element={<ReportsPage transactions={transactions} accounts={accounts} investments={investments} emis={emis} sips={[]} savings={savings} globalDisplayCurrency={globalDisplayCurrency} />} />
            <Route path="/settings" element={<SettingsPage 
              initialSettings={appSettings} 
              onSaveSettings={handleSaveAppSettings} 
              onPushToCosmos={(cs) => handleManualPushToCosmos(cs)} 
              onPullFromCosmos={(cs) => handleManualPullFromCosmos(cs)}
              onWipeLocalData={handleWipeLocalData}
              onArchiveCosmosData={handleArchiveCosmosData}
              onError={(err) => setGlobalError(err)}
            />} />
          </Routes>
        </main>
      </div>

        <ErrorModal error={globalError} onClose={() => setGlobalError(null)} />
      </div>
    </HashRouter>
  );
};

export default App;
