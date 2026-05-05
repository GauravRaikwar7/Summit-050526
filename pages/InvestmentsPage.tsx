import React, { useState, useRef } from 'react';
import { Investment, InvestmentType, InvestmentMode, Account, AccountType, CurrencyCode } from '../types';
import Modal from '../components/Modal';
import FormField from '../components/forms/FormField';
import { PlusCircleIcon, TrashIcon, ChartPieIcon, ImportIcon, ArrowPathIcon, CalendarDaysIcon } from '../components/icons';
import { formatCurrency, formatDate, getTodayISOString } from '../utils/formatters';
import { excelParserService } from '../services/excelParserService';
import MutualFundSearch from '../components/MutualFundSearch';
import { mutualFundService } from '../services/mutualFundService';

interface InvestmentsPageProps {
  investments: Investment[];
  addInvestment: (investment: Omit<Investment, 'id'>) => void;
  updateInvestment: (investment: Investment) => void;
  deleteInvestment: (investmentId: string) => void;
  recordInvestmentPayment: (investmentId: string, date: string, amount: number, unitPrice?: number) => void;
  accounts: Account[];
  globalDisplayCurrency: CurrencyCode;
}

interface InvestmentFormState extends Omit<Investment, 'id'> {
  totalAmount: number;
}

const InvestmentCard: React.FC<{ 
  investment: Investment, 
  onDelete: (id: string) => void, 
  onEdit: (investment: Investment) => void, 
  onRecordPayment: (investment: Investment) => void,
  displayCurrency: CurrencyCode 
}> = ({ investment, onDelete, onEdit, onRecordPayment, displayCurrency }) => {
  const currentValue = investment.quantity * investment.currentPrice;
  const purchaseValue = investment.quantity * investment.purchasePrice;
  const gainLoss = currentValue - purchaseValue;
  const gainLossPercent = purchaseValue !== 0 ? (gainLoss / purchaseValue) * 100 : 0;

  const showInterestRate = investment.type === InvestmentType.FIXED_DEPOSIT || investment.type === InvestmentType.RECURRING_DEPOSIT;

  return (
    <div className="bg-surface p-5 rounded-lg shadow-lg hover:shadow-primary/30 transition-shadow border border-slate-800">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-primary">{investment.name} {investment.symbol && `(${investment.symbol})`}</h3>
          <div className="flex items-center space-x-2">
            <p className="text-sm text-text-secondary">{investment.type}</p>
            {showInterestRate && investment.interestRate !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {investment.interestRate}% Interest
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${investment.mode === InvestmentMode.SIP ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {investment.mode}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => onDelete(investment.id)} className="text-danger hover:text-red-400" title="Delete Investment" aria-label={`Delete investment ${investment.name}`}>
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider">Units:</p>
          <p className="text-text-primary font-medium">{investment.quantity.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider">Current Value:</p>
          <p className="text-text-primary font-bold">{formatCurrency(currentValue, displayCurrency)}</p>
        </div>
        <div>
          <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider">Avg. Cost:</p>
          <p className="text-text-primary font-medium">{formatCurrency(investment.purchasePrice, displayCurrency)}</p>
        </div>
        <div>
          <p className="text-text-secondary text-[10px] uppercase font-bold tracking-wider">Current Price:</p>
          <p className="text-text-primary font-medium">{formatCurrency(investment.currentPrice, displayCurrency)}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-700 flex flex-col space-y-3">
         <div className="flex justify-between items-center mb-1">
          <span className="text-text-secondary text-[10px] uppercase font-bold tracking-wider">Total Gain/Loss:</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gainLoss >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
          </span>
         </div>
         <div>
            <p className={`text-lg font-bold ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, displayCurrency)}
            </p>
            <p className="text-[10px] text-text-secondary opacity-60">Purchased: {formatDate(investment.purchaseDate)}</p>
         </div>

         {investment.mode === InvestmentMode.SIP && (
            <div className="bg-slate-900/40 p-2 rounded border border-slate-700/50">
               <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-text-secondary">
                  <span>SIP Amount</span>
                  <span>Day of Month</span>
               </div>
               <div className="flex justify-between text-xs font-semibold text-text-primary mt-0.5">
                  <span>{formatCurrency(investment.monthlyAmount || 0, displayCurrency)}</span>
                  <span>{investment.dayOfMonth}</span>
               </div>
               {investment.lastPaidDate && (
                  <p className="text-[9px] text-sky-400 mt-1">Last paid: {formatDate(investment.lastPaidDate)}</p>
               )}
            </div>
         )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button 
          onClick={() => onEdit(investment)} 
          className="flex items-center justify-center py-2 px-3 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-text-primary font-semibold transition-all border border-slate-600 active:scale-95"
        >
          <ArrowPathIcon className="w-3.5 h-3.5 mr-2" />
          Update Price
        </button>
        {investment.mode === InvestmentMode.SIP && (
           <button 
             onClick={() => onRecordPayment(investment)} 
             className="flex items-center justify-center py-2 px-3 text-xs bg-primary hover:bg-primary-dark rounded-md text-white font-semibold transition-all shadow-sm active:scale-95"
           >
             <CalendarDaysIcon className="w-3.5 h-3.5 mr-2" />
             {investment.type === InvestmentType.RECURRING_DEPOSIT ? 'Record RD' : 'Record SIP'}
           </button>
        )}
      </div>
    </div>
  );
};

const InvestmentsPage: React.FC<InvestmentsPageProps> = ({ investments, addInvestment, updateInvestment, deleteInvestment, recordInvestmentPayment, accounts, globalDisplayCurrency }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [refreshPricesData, setRefreshPricesData] = useState<{ [id: string]: { price: string, loading: boolean, error?: string, name: string, type: InvestmentType } }>({});
  const [currentInvestment, setCurrentInvestment] = useState<Investment | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const getInitialInvestmentState = (): InvestmentFormState => ({
    name: '',
    type: InvestmentType.STOCK,
    mode: InvestmentMode.LUMPSUM,
    quantity: '' as unknown as number,
    purchasePrice: '' as unknown as number,
    currentPrice: '' as unknown as number,
    purchaseDate: getTodayISOString(),
    monthlyAmount: '' as unknown as number,
    dayOfMonth: 1,
    symbol: '',
    schemeCode: undefined as number | undefined,
    interestRate: '' as unknown as number,
    accountId: '', 
    fundingAccountId: '',
    totalAmount: '' as unknown as number,
  });

  const [newInvestment, setNewInvestment] = useState<InvestmentFormState>(getInitialInvestmentState());
  const [paymentData, setPaymentData] = useState({
    date: getTodayISOString(),
    amount: 0,
    unitPrice: 0
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const investmentAccounts = accounts.filter(acc => acc.type === AccountType.INVESTMENT_ACCOUNT || acc.type === AccountType.SAVINGS || acc.type === AccountType.CHECKING);

  const handleOpenModal = () => {
    setNewInvestment(getInitialInvestmentState());
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadSample = () => {
    excelParserService.downloadSampleExcel('investments');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await excelParserService.parseInvestments(file, newInvestment.accountId);
      if (result.error) {
        alert(result.error);
      } else if (result.investments && result.investments.length > 0) {
        result.investments.forEach(inv => {
          addInvestment(inv);
        });
        alert(`Successfully imported ${result.investments.length} investments.`);
      } else {
        alert('No investments found in the Excel file.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import investments.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, id } = e.target;
    const fieldName = (name || id) as keyof InvestmentFormState;
    const targetState = isEditModalOpen && currentInvestment ? currentInvestment : newInvestment;
    
    // We treat edit and new slightly differently because edit doesn't have totalAmount usually
    const targetSetState = isEditModalOpen 
      ? (val: Investment) => setCurrentInvestment(val) 
      : (val: InvestmentFormState) => setNewInvestment(val);

    const updatedValue = value;
    const autoUpdate: Partial<InvestmentFormState> = {};

    // Auto-calculate logic only for new investments where totalAmount is present
    if (!isEditModalOpen) {
       const inv = targetState as InvestmentFormState;
       if (fieldName === 'totalAmount') {
          const amt = parseFloat(value) || 0;
          const price = parseFloat(inv.purchasePrice as unknown as string) || 0;
          if (price > 0) {
             autoUpdate.quantity = ((amt / price).toFixed(4) as unknown as number);
          }
       } else if (fieldName === 'purchasePrice') {
          const price = parseFloat(value) || 0;
          const amt = parseFloat(inv.totalAmount as unknown as string) || 0;
          const qty = parseFloat(inv.quantity as unknown as string) || 0;
          if (amt > 0 && price > 0) {
             autoUpdate.quantity = ((amt / price).toFixed(4) as unknown as number);
          } else if (qty > 0 && price > 0) {
             autoUpdate.totalAmount = ((qty * price).toFixed(2) as unknown as number);
          }
           // For mutual funds, currentPrice often matches purchasePrice initially
           if (inv.type === InvestmentType.MUTUAL_FUNDS) {
              autoUpdate.currentPrice = (value as unknown as number);
           }
       } else if (fieldName === 'quantity') {
          const qty = parseFloat(value) || 0;
          const price = parseFloat(inv.purchasePrice as unknown as string) || 0;
          if (price > 0) {
             autoUpdate.totalAmount = ((qty * price).toFixed(2) as unknown as number);
          }
       }
    }

    if (isEditModalOpen) {
      (targetSetState as (val: Investment) => void)({
        ...targetState as Investment,
        [fieldName]: updatedValue
      });
    } else {
      (targetSetState as (val: InvestmentFormState) => void)({
        ...targetState as InvestmentFormState,
        ...autoUpdate,
        [fieldName]: updatedValue
      } as InvestmentFormState);
    }

    if (formErrors[fieldName]) {
      setFormErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };
  
  const validateForm = (investmentData: Omit<Investment, 'id'> | Investment) => {
    const errors: { [key: string]: string } = {};
    const parseAmount = (val: string | number) => {
      if (val === undefined || val === null || val === '') return NaN;
      return typeof val === 'string' ? parseFloat(val) : val;
    };

    if (!investmentData.name.trim()) errors.name = "Investment name is required.";

    if (investmentData.mode === InvestmentMode.SIP) {
       const monthlyAmount = parseAmount(investmentData.monthlyAmount || '');
       if (isNaN(monthlyAmount) || monthlyAmount <= 0) {
          errors.monthlyAmount = "Monthly amount is required for SIP.";
       }
       // For SIP, existing units (quantity) and purchase price are optional
       const qty = parseAmount(investmentData.quantity);
       if (!isNaN(qty) && qty < 0) errors.quantity = "Quantity cannot be negative.";
       
       const price = parseAmount(investmentData.purchasePrice);
       if (!isNaN(price) && price < 0) errors.purchasePrice = "Price cannot be negative.";
    } else {
       if (isNaN(parseAmount(investmentData.quantity)) || parseAmount(investmentData.quantity) <= 0) errors.quantity = "Quantity must be a positive number.";
       if (isNaN(parseAmount(investmentData.purchasePrice)) || parseAmount(investmentData.purchasePrice) < 0) errors.purchasePrice = "Purchase price must be a non-negative number.";
       if (isNaN(parseAmount(investmentData.currentPrice)) || parseAmount(investmentData.currentPrice) < 0) errors.currentPrice = "Current price must be a non-negative number.";
    }

    if (!investmentData.purchaseDate) errors.purchaseDate = "Purchase date is required.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(newInvestment)) return;
    
    const quantity = parseFloat(newInvestment.quantity as unknown as string) || 0;
    const purchasePrice = parseFloat(newInvestment.purchasePrice as unknown as string) || 0;
    const monthlyAmount = parseFloat(newInvestment.monthlyAmount as unknown as string) || 0;
    const dayOfMonth = parseInt(newInvestment.dayOfMonth as unknown as string) || 1;
    
    // In SIP mode or if currentPrice is empty, use purchasePrice (avg cost) as current price
    const currentPriceStr = newInvestment.currentPrice as unknown as string;
    const currentPriceRaw = parseFloat(currentPriceStr);
    const currentPrice = (!isNaN(currentPriceRaw) && currentPriceStr !== '') ? currentPriceRaw : purchasePrice;

    addInvestment({
      ...newInvestment,
      quantity,
      purchasePrice,
      currentPrice,
      monthlyAmount: newInvestment.mode === InvestmentMode.SIP ? monthlyAmount : undefined,
      dayOfMonth: newInvestment.mode === InvestmentMode.SIP ? dayOfMonth : undefined,
      interestRate: newInvestment.interestRate && newInvestment.interestRate !== ('' as unknown as number) ? parseFloat(newInvestment.interestRate as unknown as string) : undefined
    });
    setIsModalOpen(false);
  };

  const handleMfSelect = async (schemeCode: number, schemeName: string) => {
    setNewInvestment(prev => ({
      ...prev,
      name: schemeName,
      schemeCode: schemeCode,
      type: InvestmentType.MUTUAL_FUNDS
    }));

    // Fetch latest NAV automatically on selection
    try {
      setNewInvestment(prev => ({ ...prev, name: 'Fetching details...' }));
      const nav = await mutualFundService.getLatestNav(schemeCode);
      if (nav !== null) {
        setNewInvestment(prev => {
          const navValue = nav as unknown as number;
          const purchasePrice = (prev.purchasePrice as unknown as string === '' || prev.purchasePrice === 0) 
            ? navValue 
            : prev.purchasePrice;
          
          let quantity = prev.quantity;
          const amt = parseFloat(prev.totalAmount as unknown as string) || 0;
          if (amt > 0 && purchasePrice > 0) {
            quantity = (amt / purchasePrice).toFixed(4) as unknown as number;
          }

          return {
            ...prev,
            name: schemeName,
            currentPrice: navValue,
            purchasePrice,
            quantity
          };
        });
      } else {
        setNewInvestment(prev => ({ ...prev, name: schemeName }));
      }
    } catch (error) {
      console.error('Failed to fetch NAV during selection:', error);
      setNewInvestment(prev => ({ ...prev, name: schemeName }));
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentInvestment && validateForm(currentInvestment)) {
      const investmentToUpdate = {
          ...currentInvestment,
          currentPrice: parseFloat(currentInvestment.currentPrice as unknown as string) || 0,
      };
      updateInvestment(investmentToUpdate);
      setIsEditModalOpen(false);
      setCurrentInvestment(null);
      setFormErrors({});
    }
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentInvestment) {
      recordInvestmentPayment(
        currentInvestment.id, 
        paymentData.date, 
        parseFloat(paymentData.amount as unknown as string), 
        parseFloat(paymentData.unitPrice as unknown as string)
      );
      setIsPaymentModalOpen(false);
      setCurrentInvestment(null);
    }
  };

  const openPaymentModal = async (investment: Investment) => {
    setCurrentInvestment(investment);
    let currentPrice = investment.currentPrice;
    
    if (investment.schemeCode) {
      const nav = await mutualFundService.getLatestNav(investment.schemeCode);
      if (nav !== null) currentPrice = nav;
    }

    setPaymentData({
      date: getTodayISOString(),
      amount: investment.monthlyAmount || 0,
      unitPrice: currentPrice
    });
    setIsPaymentModalOpen(true);
  };

  const openEditModal = (investment: Investment) => {
    setCurrentInvestment({...investment});
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleRefreshPricesOpen = async () => {
    const initialData: typeof refreshPricesData = {};
    investments.forEach(inv => {
      initialData[inv.id] = { 
        price: inv.currentPrice.toString(), 
        loading: inv.type === InvestmentType.MUTUAL_FUNDS && !!inv.schemeCode, 
        name: inv.name,
        type: inv.type
      };
    });
    setRefreshPricesData(initialData);
    setIsRefreshModalOpen(true);

    // Trigger auto-fetching for MFs
    investments.forEach(async (inv) => {
      if (inv.type === InvestmentType.MUTUAL_FUNDS && inv.schemeCode) {
        try {
          const nav = await mutualFundService.getLatestNav(inv.schemeCode);
          if (nav !== null) {
            setRefreshPricesData(prev => ({
              ...prev,
              [inv.id]: { ...prev[inv.id], price: nav.toString(), loading: false }
            }));
          } else {
            setRefreshPricesData(prev => ({
              ...prev,
              [inv.id]: { ...prev[inv.id], loading: false, error: 'NAV not found' }
            }));
          }
        } catch (_error) {
          setRefreshPricesData(prev => ({
            ...prev,
            [inv.id]: { ...prev[inv.id], loading: false, error: 'Fetch failed' }
          }));
        }
      }
    });
  };

  const handleSaveRefreshedPrices = () => {
    Object.entries(refreshPricesData).forEach(([id, data]) => {
      const investment = investments.find(inv => inv.id === id);
      const newPrice = parseFloat(data.price);
      if (investment && !isNaN(newPrice) && newPrice !== investment.currentPrice) {
        updateInvestment({
          ...investment,
          currentPrice: newPrice
        });
      }
    });
    setIsRefreshModalOpen(false);
  };

  if (accounts.length === 0 && !isModalOpen) {
    return (
       <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-primary">Investments</h1>
         <div className="text-center py-10 bg-surface rounded-lg">
            <ChartPieIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
            <p className="text-text-secondary text-lg">No accounts found.</p>
            <p className="text-text-secondary text-sm">Please add an account before tracking investments.</p>
          </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Investments</h1>
         <div className="flex items-center space-x-3">
          <button onClick={handleDownloadSample} className="text-xs text-primary hover:underline font-medium">
            Download Sample
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center disabled:opacity-50"
          >
            <ImportIcon className="w-5 h-5 mr-2" />
            {isImporting ? 'Importing...' : 'Import Excel'}
          </button>
          {investments.length > 0 && (
            <button
              onClick={handleRefreshPricesOpen}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Refresh Prices
            </button>
          )}
          {accounts.length > 0 && (
              <button
              onClick={handleOpenModal}
              className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center"
              >
              <PlusCircleIcon className="w-5 h-5 mr-2" />
              Add Investment
              </button>
          )}
         </div>
      </div>

      {investments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {investments.map(inv => {
            const account = accounts.find(acc => acc.id === inv.accountId);
            // Use account's currency if available, otherwise fallback to global display currency
            const displayCurrencyForCard = account?.currency || globalDisplayCurrency;
            return <InvestmentCard 
              key={inv.id} 
              investment={inv} 
              onDelete={deleteInvestment} 
              onEdit={openEditModal} 
              onRecordPayment={openPaymentModal}
              displayCurrency={displayCurrencyForCard}
            />;
          })}
        </div>
      ) : (
        <div className="text-center py-10 bg-surface rounded-lg">
          <ChartPieIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary text-lg">No investments yet.</p>
          <p className="text-text-secondary text-sm">{accounts.length > 0 ? 'Click "Add Investment" to track your assets.' : 'Create an account first.'}</p>
        </div>
      )}

      {/* Add Investment Modal */}
      <Modal isOpen={isModalOpen} onClose={() => {setIsModalOpen(false); setFormErrors({});}} title="Add New Investment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
            <MutualFundSearch onSelect={handleMfSelect} initialValue={newInvestment.name} />
            <FormField label="Entry Name" id="name" value={newInvestment.name} onChange={handleInputChange} placeholder="e.g., Apple Stock, Bitcoin" required error={formErrors.name} />
          </div>
          <FormField label="Symbol (Optional)" id="symbol" value={newInvestment.symbol || ''} onChange={handleInputChange} placeholder="e.g., AAPL, BTC" />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" id="type" type="select" value={newInvestment.type} onChange={handleInputChange} options={Object.values(InvestmentType).map(type => ({ value: type, label: type }))} required />
            <FormField label="Investment Mode" id="mode" type="select" value={newInvestment.mode} onChange={handleInputChange} options={Object.values(InvestmentMode).map(mode => ({ value: mode, label: mode }))} required />
          </div>

          {(newInvestment.type === InvestmentType.FIXED_DEPOSIT || newInvestment.type === InvestmentType.RECURRING_DEPOSIT) && (
            <FormField 
              label="Interest Rate (%)" 
              id="interestRate" 
              type="number" 
              value={newInvestment.interestRate} 
              onChange={handleInputChange} 
              placeholder="e.g., 7.5" 
              step="0.01" 
              required 
            />
          )}

          {newInvestment.mode === InvestmentMode.SIP ? (
            <div className="bg-sky-500/5 p-4 rounded-xl border border-sky-500/20 space-y-4">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest">{newInvestment.type === InvestmentType.RECURRING_DEPOSIT ? 'RD' : 'SIP'} Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Monthly Investment" id="monthlyAmount" type="number" value={newInvestment.monthlyAmount} onChange={handleInputChange} placeholder="5000" min="0" required error={formErrors.monthlyAmount} />
                <FormField label="Investment Day" id="dayOfMonth" type="number" value={newInvestment.dayOfMonth} onChange={handleInputChange} min="1" max="31" required description="Day of month" />
              </div>
              <FormField label="Start Date" id="purchaseDate" type="date" value={newInvestment.purchaseDate} onChange={handleInputChange} required error={formErrors.purchaseDate} />
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Existing Units (Opt)" id="quantity" type="number" value={newInvestment.quantity || 0} onChange={handleInputChange} placeholder="e.g. 10.5" min="0" step="any" />
                <FormField label="Avg Purchase Price" id="purchasePrice" type="number" value={newInvestment.purchasePrice || 0} onChange={handleInputChange} placeholder="Current avg cost" min="0" step="any" />
              </div>
              <input type="hidden" name="currentPrice" value={newInvestment.purchasePrice || 0} />
            </div>
          ) : (
            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 space-y-4">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Holding Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Investment Amount" id="totalAmount" type="number" value={newInvestment.totalAmount} onChange={handleInputChange} placeholder="e.g. 50000" min="0" />
                <FormField label="Purchase Price (NAV)" id="purchasePrice" type="number" value={newInvestment.purchasePrice} onChange={handleInputChange} placeholder="Price per unit" min="0" step="any" required error={formErrors.purchasePrice} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Calculated Units" id="quantity" type="number" value={newInvestment.quantity} onChange={handleInputChange} placeholder="Quantity" min="0" step="any" required error={formErrors.quantity} />
                <FormField label="Current NAV/Price" id="currentPrice" type="number" value={newInvestment.currentPrice} onChange={handleInputChange} placeholder="Market price" min="0" step="any" required error={formErrors.currentPrice} />
              </div>
              {newInvestment.type === InvestmentType.MUTUAL_FUNDS && parseFloat(newInvestment.totalAmount as unknown as string) > 0 && parseFloat(newInvestment.purchasePrice as unknown as string) > 0 && (
                <div className="text-[10px] text-primary/80 bg-primary/5 p-2 rounded-lg border border-primary/20 animate-pulse">
                  Calculation: {newInvestment.totalAmount} / {newInvestment.purchasePrice} = {newInvestment.quantity} Units
                </div>
              )}
              <FormField label="Purchase Date" id="purchaseDate" type="date" value={newInvestment.purchaseDate} onChange={handleInputChange} required error={formErrors.purchaseDate} />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
                label="Investment Account (Optional)"
                id="accountId"
                type="select"
                value={newInvestment.accountId || ''}
                onChange={handleInputChange}
                options={[{ value: '', label: 'None' }, ...investmentAccounts.map(acc => ({ value: acc.id, label: `${acc.name} (${acc.currency})` }))]}
                placeholder="Where is it held?"
            />
            <FormField
                label="Funding Account (Deduct From)"
                id="fundingAccountId"
                name="fundingAccountId"
                type="select"
                value={newInvestment.fundingAccountId || ''}
                onChange={handleInputChange}
                options={[{ value: '', label: 'None (Historical)' }, ...accounts.filter(a => a.type !== AccountType.LOAN && a.type !== AccountType.INVESTMENT_ACCOUNT).map(acc => ({ value: acc.id, label: `${acc.name} (${acc.currency})` }))]}
                placeholder="Where did money come from?"
            />
          </div>

           <p className="text-xs text-text-secondary">
            Prices entered will be in {newInvestment.accountId && accounts.find(a=>a.id === newInvestment.accountId) ? accounts.find(a=>a.id === newInvestment.accountId)?.currency : globalDisplayCurrency}.
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => {setIsModalOpen(false); setFormErrors({});}} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">Add Investment</button>
          </div>
        </form>
      </Modal>

      {/* Edit Investment Modal (for current price) */}
      {currentInvestment && (
        <Modal isOpen={isEditModalOpen} onClose={() => {setIsEditModalOpen(false); setCurrentInvestment(null); setFormErrors({});}} title={`Update ${currentInvestment.name}`}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <p className="text-text-secondary">Update the current market price for this investment. 
            The price should be in {accounts.find(a=>a.id === currentInvestment.accountId)?.currency || globalDisplayCurrency}.</p>
            <FormField 
                label="Current Price (per unit)" 
                id="currentPrice" 
                type="number" 
                value={currentInvestment.currentPrice} 
                onChange={handleInputChange} 
                min="0" 
                step="any" 
                required 
                error={formErrors.currentPrice} 
            />
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => {setIsEditModalOpen(false); setCurrentInvestment(null); setFormErrors({});}} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">Update Price</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record SIP Payment Modal */}
      {currentInvestment && isPaymentModalOpen && (
        <Modal isOpen={isPaymentModalOpen} onClose={() => {setIsPaymentModalOpen(false); setCurrentInvestment(null);}} title={`Record SIP: ${currentInvestment.name}`}>
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-4">
               <div className="flex justify-between text-xs text-text-secondary uppercase tracking-widest font-bold">
                  <span>Current Holding</span>
                  <span>Avg Cost</span>
               </div>
               <div className="flex justify-between text-sm font-semibold text-text-primary mt-1">
                  <span>{currentInvestment.quantity.toFixed(4)} Units</span>
                  <span>{formatCurrency(currentInvestment.purchasePrice, accounts.find(a=>a.id===currentInvestment.accountId)?.currency || globalDisplayCurrency)}</span>
               </div>
            </div>

            <FormField 
              label="Payment Date" 
              id="date" 
              type="date" 
              value={paymentData.date} 
              onChange={(e) => setPaymentData(prev => ({ ...prev, date: e.target.value }))} 
              required 
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField 
                label="Amount Paid" 
                id="amount" 
                type="number" 
                value={paymentData.amount} 
                onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} 
                required 
              />
              <FormField 
                label="NAV (Price per Unit)" 
                id="unitPrice" 
                type="number" 
                value={paymentData.unitPrice} 
                onChange={(e) => setPaymentData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))} 
                step="any"
                required 
                description="The price at which units are bought"
              />
            </div>
            
            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Expected Units to be added:</span>
                <span className="text-primary font-bold">
                  {paymentData.unitPrice > 0 ? (paymentData.amount / paymentData.unitPrice).toFixed(4) : '0.0000'}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-text-secondary leading-relaxed italic">
               * This will add units to your balance and deduct funds from your chosen account.
            </p>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => {setIsPaymentModalOpen(false); setCurrentInvestment(null);}} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">Confirm Payment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Refresh Prices Modal */}
      <Modal isOpen={isRefreshModalOpen} onClose={() => setIsRefreshModalOpen(false)} title="Refresh Investment Prices">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-text-secondary text-sm">
            Mutual Fund prices are being fetched automatically. For other investments, please enter the current market price per unit.
          </p>
          
          <div className="space-y-3">
            {Object.entries(refreshPricesData).map(([id, data]) => (
              <div key={id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">{data.name}</p>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider">{data.type}</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <input 
                      type="number" 
                      value={data.price} 
                      onChange={(e) => setRefreshPricesData(prev => ({ ...prev, [id]: { ...prev[id], price: e.target.value } }))}
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm w-32 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      disabled={data.loading}
                    />
                    {data.loading && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <ArrowPathIcon className="w-3 h-3 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  {data.type === InvestmentType.MUTUAL_FUNDS && (
                    <div className="w-20">
                      {data.loading ? (
                        <span className="text-[10px] text-sky-400 font-bold">Fetching...</span>
                      ) : data.error ? (
                        <span className="text-[10px] text-danger font-bold">{data.error}</span>
                      ) : (
                        <span className="text-[10px] text-success font-bold">Updated</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-700 mt-6">
          <button 
            type="button" 
            onClick={() => setIsRefreshModalOpen(false)} 
            className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveRefreshedPrices} 
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
          >
            Save All Prices
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default InvestmentsPage;