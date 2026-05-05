
import * as XLSX from 'xlsx';
import { RawTransaction, TransactionType, DocumentParseResult, InvestmentMode, InvestmentType, EMI, Saving, SavingType, RawInvestment } from '../types';

export const excelParserService = {
  parseTransactions: async (
    file: File
  ): Promise<DocumentParseResult> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Use raw header mapping to find rows correctly
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>[]>(worksheet, { header: 1 }) as unknown as unknown[][];

      if (!jsonData || jsonData.length === 0) {
        return { transactions: [], error: 'Excel file is empty or has no data.' };
      }

      // Specialized parsing for the format in the image
      const transactions: RawTransaction[] = [];
      let headersFound = false;
      let headerRowIndex = -1;

      // Find the header row "Date", "Narration", etc.
      for (let i = 0; i < Math.min(20, jsonData.length); i++) {
        const row = jsonData[i];
        if (Array.isArray(row) && row.some(cell => String(cell).toLowerCase().includes('narration'))) {
          headersFound = true;
          headerRowIndex = i;
          break;
        }
      }

      if (headersFound) {
        const headerRow = jsonData[headerRowIndex];
        const findColumn = (aliases: string[]) => headerRow.findIndex((h: unknown) => {
          const header = String(h || '').toLowerCase();
          return aliases.some(alias => header.includes(alias));
        });

        const valueDateIdx = findColumn(['value date', 'value dt']);
        const txnDateIdx = findColumn(['transaction date', 'txn date', 'tx date']);
        const genericDateIdx = findColumn(['date']);
        
        // Priority: Value Date -> Transaction Date -> Generic Date
        const dateIdx = valueDateIdx !== -1 ? valueDateIdx : (txnDateIdx !== -1 ? txnDateIdx : genericDateIdx);
        
        const narrationIdx = findColumn(['narration', 'description', 'particulars', 'narrative']);
        const refIdx = findColumn(['ref', 'chq', 'cheque']);
        const withdrawalIdx = findColumn(['withdrawal', 'debit', 'dr']);
        const depositIdx = findColumn(['deposit', 'credit', 'cr']);
        const closingBalIdx = findColumn(['closing balance', 'closing bal', 'balance']);

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          // Stop if we hit "STATEMENT SUMMARY" or empty row
          if (String(row[0]).includes('STATEMENT SUMMARY') || String(row[0]).includes('****')) {
            if (String(row[0]).includes('****')) continue; // skip separator rows
            break; 
          }

          const dateVal = row[dateIdx];
          const narration = String(row[narrationIdx] || '').trim();
          const refNo = String(row[refIdx] || '').trim();
          const withdrawal = parseFloat(String(row[withdrawalIdx] || '0').replace(/[^0-9.-]+/g, ''));
          const deposit = parseFloat(String(row[depositIdx] || '0').replace(/[^0-9.-]+/g, ''));
          const balanceAfter = closingBalIdx !== -1 ? parseFloat(String(row[closingBalIdx] || '0').replace(/[^0-9.-]+/g, '')) : undefined;

          if (!narration || (isNaN(withdrawal) && isNaN(deposit))) continue;

          let dateStr = '';
          if (dateVal instanceof Date) {
            // Use local date components to avoid timezone shifts from toISOString()
            const year = dateVal.getFullYear();
            const month = String(dateVal.getMonth() + 1).padStart(2, '0');
            const day = String(dateVal.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          } else if (typeof dateVal === 'number') {
            const date = XLSX.SSF.parse_date_code(dateVal);
            dateStr = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          } else if (typeof dateVal === 'string' && dateVal.trim()) {
            const CleanDate = dateVal.trim().replace(/-/g, '/');
            const parts = CleanDate.split('/');
            if (parts.length === 3) {
              let day, month, year;
              if (parts[0].length === 4) {
                year = parts[0];
                month = parts[1].padStart(2, '0');
                day = parts[2].padStart(2, '0');
              } else {
                day = parts[0].padStart(2, '0');
                month = parts[1].padStart(2, '0');
                year = parts[2];
                if (year.length === 2) year = '20' + year;
              }
              dateStr = `${year}-${month}-${day}`;
            }
          }

          if (dateStr) {
            const amount = deposit > 0 ? deposit : withdrawal;
            const type = deposit > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
            
            transactions.push({
              date: dateStr,
              description: narration,
              amount: Math.abs(amount),
              type,
              category: type === TransactionType.INCOME ? 'Other Income' : 'Other Expense',
              notes: `Ref: ${refNo} | Imported from ${file.name}`,
              balanceAfter: isNaN(balanceAfter as number) ? undefined : balanceAfter
            });
          }
        }

        let finalBalance: number | undefined;
        let balanceDate: string | undefined;

        if (transactions.length > 0) {
          // Sort by date to find the absolute latest one just in case the file isn't sorted
          const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
          const lastTx = sorted[sorted.length - 1];
          balanceDate = lastTx.date;
          finalBalance = lastTx.balanceAfter;
        }

        return { 
          transactions,
          finalBalance,
          balanceDate
        };
      }

      // Fallback
      const directResult = tryDirectParse(XLSX.utils.sheet_to_json(worksheet), file.name);
      if (directResult && directResult.transactions.length > 0) {
        return directResult;
      }

      return { transactions: [], error: 'Could not identify transaction headers in Excel.' };

    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return { transactions: [], error: `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}` };
    }
  },

  parseInvestments: async (
    file: File,
    defaultAccountId?: string
  ): Promise<{ investments: Omit<InvestmentType, 'id'>[]; error?: string }> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

      if (!jsonData || jsonData.length === 0) {
        return { investments: [], error: 'Excel file is empty.' };
      }

      const investments: RawInvestment[] = [];
      let headerRowIndex = -1;

      const invAliases = ['name', 'asset', 'security', 'holding', 'description', 'stock', 'crypto'];
      for (let i = 0; i < Math.min(20, jsonData.length); i++) {
        const row = jsonData[i];
        if (Array.isArray(row) && row.some(cell => invAliases.some(alias => String(cell).toLowerCase().includes(alias)))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex !== -1) {
        const headerRow = jsonData[headerRowIndex] as unknown[];
        const findColumn = (aliases: string[]) => headerRow.findIndex((h: unknown) => {
          const header = String(h || '').toLowerCase();
          return aliases.some(alias => header.includes(alias));
        });

        const nameIdx = findColumn(['name', 'asset', 'security', 'holding', 'description', 'stock', 'crypto']);
        const symbolIdx = findColumn(['symbol', 'ticker', 'code']);
        const qtyIdx = findColumn(['quantity', 'qty', 'units', 'shares', 'balance']);
        const purchasePriceIdx = findColumn(['purchase price', 'buy price', 'cost', 'avg price', 'unit cost']);
        const currentPriceIdx = findColumn(['current price', 'cmp', 'market price', 'price', 'value per unit']);
        const dateIdx = findColumn(['date', 'purchased', 'buy date']);
        const typeIdx = findColumn(['type', 'category', 'class']);
        const fundingAccIdx = findColumn(['funding account', 'deduct from', 'source account', 'payment account']);
        const holdingAccIdx = findColumn(['holding account', 'investment account', 'account id']);

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!Array.isArray(row) || row.length === 0) continue;

          const name = String(row[nameIdx] || '').trim();
          if (!name) continue;

          const qty = parseFloat(String(row[qtyIdx] || '0').replace(/[^0-9.-]+/g, ''));
          if (isNaN(qty) || qty === 0) continue;

          const purchasePrice = parseFloat(String(row[purchasePriceIdx] || '0').replace(/[^0-9.-]+/g, ''));
          const currentPrice = currentPriceIdx !== -1 ? parseFloat(String(row[currentPriceIdx] || '0').replace(/[^0-9.-]+/g, '')) : purchasePrice;
          
          let dateStr = new Date().toISOString().split('T')[0];
          if (dateIdx !== -1) {
             const dVal = row[dateIdx];
             if (dVal instanceof Date) dateStr = dVal.toISOString().split('T')[0];
             else if (typeof dVal === 'string') dateStr = dVal;
          }

          let invType: InvestmentType = InvestmentType.STOCK;
          if (typeIdx !== -1) {
            const tVal = String(row[typeIdx]).toLowerCase();
            if (tVal.includes('gold') || tVal.includes('silver') || tVal.includes('metal')) invType = InvestmentType.GOLD;
            else if (tVal.includes('mf') || tVal.includes('mutual')) invType = InvestmentType.MUTUAL_FUNDS;
            else if (tVal.includes('fd') || tVal.includes('fixed')) invType = InvestmentType.FIXED_DEPOSIT;
            else if (tVal.includes('rd') || tVal.includes('recurring')) invType = InvestmentType.RECURRING_DEPOSIT;
            else if (tVal.includes('crypto')) invType = InvestmentType.CRYPTO;
            else if (tVal.includes('estate')) invType = InvestmentType.REAL_ESTATE;
            else if (tVal.includes('stock') || tVal.includes('equity')) invType = InvestmentType.STOCK;
            else invType = InvestmentType.OTHER;
          }

          investments.push({
            name,
            symbol: symbolIdx !== -1 ? String(row[symbolIdx] || '').trim() : undefined,
            quantity: qty,
            mode: InvestmentMode.LUMPSUM,
            purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
            currentPrice: isNaN(currentPrice) ? (isNaN(purchasePrice) ? 0 : purchasePrice) : currentPrice,
            purchaseDate: dateStr,
            type: invType,
            accountId: (holdingAccIdx !== -1 && row[holdingAccIdx]) ? String(row[holdingAccIdx]) : defaultAccountId,
            fundingAccountId: (fundingAccIdx !== -1 && row[fundingAccIdx]) ? String(row[fundingAccIdx]) : undefined
          });
        }

        return { investments };
      }

      return { investments: [], error: 'Could not identify investment headers.' };

    } catch (error) {
       console.error('Error parsing Investment Excel:', error);
       return { investments: [], error: 'Failed to parse Investment data.' };
    }
  },

  parseEMIs: async (file: File, accountId: string): Promise<{ emis: Omit<EMI, 'id'>[], error?: string }> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const emis: Omit<EMI, 'id'>[] = rows.map(row => ({
        name: String(row.Name || row.name || 'Unknown EMI'),
        bankName: String(row.Bank || row.bank || row.bankName || 'Unknown Bank'),
        loanAmount: parseFloat(String(row.LoanAmount || row.loanAmount || 0).replace(/[^0-9.-]+/g, '')),
        monthlyInstallment: parseFloat(String(row.MonthlyInstallment || row.monthlyInstallment || row.EMI || row.emi || 0).replace(/[^0-9.-]+/g, '')),
        startDate: row.StartDate instanceof Date ? row.StartDate.toISOString().split('T')[0] : String(row.StartDate || row.startDate || new Date().toISOString().split('T')[0]),
        endDate: row.EndDate instanceof Date ? row.EndDate.toISOString().split('T')[0] : String(row.EndDate || row.endDate || new Date().toISOString().split('T')[0]),
        interestRate: parseFloat(String(row.InterestRate || row.interestRate || row.Rate || row.rate || 0).replace(/[^0-9.-]+/g, '')),
        accountId: accountId,
        loanAccountId: row.LoanAccountId || row.loanAccountId || undefined,
        category: (row.Category || row.category ? String(row.Category || row.category) : 'EMI'),
        lastPaidDate: row.PaidDate instanceof Date ? row.PaidDate.toISOString().split('T')[0] : (row.PaidDate || row.LastPaidDate ? String(row.PaidDate || row.LastPaidDate) : undefined),
        lastPaidAmount: row.PaidAmount !== undefined || row.LastPaidAmount !== undefined ? parseFloat(String(row.PaidAmount || row.LastPaidAmount).replace(/[^0-9.-]+/g, '')) : undefined,
      }));

      return { emis };
    } catch (err) {
      return { emis: [], error: `EMI Parse failed: ${String(err)}` };
    }
  },

  parseSavings: async (file: File, accountId: string): Promise<{ savings: Omit<Saving, 'id'>[], error?: string }> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const savings: Omit<Saving, 'id'>[] = rows.map(row => ({
        name: String(row.Name || row.name || 'Savings Goal'),
        amount: parseFloat(String(row.Amount || row.amount || 0).replace(/[^0-9.-]+/g, '')),
        date: row.Date instanceof Date ? row.Date.toISOString().split('T')[0] : String(row.Date || row.date || new Date().toISOString().split('T')[0]),
        type: (row.Type || row.type) === 'Auto-calculated' ? SavingType.AUTO : SavingType.USER,
        accountId: accountId,
        notes: String(row.Notes || row.notes || ''),
        paidDate: row.PaidDate instanceof Date ? row.PaidDate.toISOString().split('T')[0] : (row.PaidDate ? String(row.PaidDate) : undefined),
        paidAmount: row.PaidAmount !== undefined ? parseFloat(String(row.PaidAmount).replace(/[^0-9.-]+/g, '')) : undefined
      }));

      return { savings };
    } catch (err) {
      return { savings: [], error: `Savings Parse failed: ${String(err)}` };
    }
  },

  downloadSampleExcel: (type: 'transactions' | 'investments' | 'emis' | 'savings') => {
    let data: unknown[] = [];
    let fileName = '';

    switch (type) {
      case 'transactions':
        data = [{ Date: '2024-01-01', Description: 'Salary', Amount: 5000, Type: 'Income', Category: 'Salary' },
                { Date: '2024-01-05', Description: 'Rent', Amount: 1200, Type: 'Expense', Category: 'Housing' }];
        fileName = 'sample_transactions.xlsx';
        break;
      case 'investments':
        data = [{ Name: 'Apple Inc', Symbol: 'AAPL', Type: 'Stock', Mode: 'Lumpsum', Quantity: 10, PurchasePrice: 150, CurrentPrice: 190, PurchaseDate: '2023-05-10' }];
        fileName = 'sample_investments.xlsx';
        break;
      case 'emis':
        data = [{ 
          Name: 'Home Loan', 
          Bank: 'HDFC', 
          LoanAmount: 5000000, 
          MonthlyInstallment: 45000, 
          StartDate: '2023-01-01', 
          EndDate: '2043-01-01', 
          InterestRate: 8.5, 
          PaidDate: '2024-04-01', 
          PaidAmount: 45000,
          LoanAccountId: 'loan-acc-id-if-any'
        }];
        fileName = 'sample_emis.xlsx';
        break;
      case 'savings':
        data = [{ Name: 'Emergency Fund', Amount: 1000, Date: '2024-04-01', Type: 'User-determined', Notes: 'Monthly goal', PaidDate: '2024-04-02', PaidAmount: 1000 }];
        fileName = 'sample_savings.xlsx';
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, fileName);
  }
};

function tryDirectParse(data: Record<string, unknown>[], fileName: string): DocumentParseResult | null {
  const transactions: RawTransaction[] = [];
  
  const dateAliases = ['date', 'transaction date', 'tx date', 'txn date', 'day'];
  const descAliases = ['description', 'desc', 'narrative', 'particulars', 'payee', 'transaction', 'remarks'];
  const amountAliases = ['amount', 'value', 'transaction amount', 'total', 'amt'];
  const typeAliases = ['type', 'transaction type', 'dr/cr', 'debit/credit'];
  const balanceAliases = ['balance', 'closing balance', 'closing bal', 'running balance'];

  for (const row of data) {
    let dateStr = '';
    let description = '';
    let amount = 0;
    let type: TransactionType = TransactionType.EXPENSE;
    let balanceAfter: number | undefined;

    const rowKeys = Object.keys(row);
    
    const dateKey = rowKeys.find(k => dateAliases.includes(k.toLowerCase()));
    if (dateKey) {
      const val = row[dateKey];
      if (val instanceof Date) {
        dateStr = val.toISOString().split('T')[0];
      } else {
        dateStr = String(val);
      }
    }

    const descKey = rowKeys.find(k => descAliases.includes(k.toLowerCase()));
    if (descKey) description = String(row[descKey]);

    const amountKey = rowKeys.find(k => amountAliases.includes(k.toLowerCase()));
    if (amountKey) {
      const val = parseFloat(String(row[amountKey]).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(val)) {
        amount = Math.abs(val);
        if (val > 0) type = TransactionType.INCOME; 
      }
    }

    const typeKey = rowKeys.find(k => typeAliases.includes(k.toLowerCase()));
    if (typeKey) {
      const val = String(row[typeKey]).toLowerCase();
      if (val.includes('credit') || val.includes('cr') || val.includes('income') || val.includes('deposit')) {
        type = TransactionType.INCOME;
      } else if (val.includes('debit') || val.includes('dr') || val.includes('expense') || val.includes('withdrawal')) {
        type = TransactionType.EXPENSE;
      }
    }

    const balanceKey = rowKeys.find(k => balanceAliases.includes(k.toLowerCase()));
    if (balanceKey) {
      const val = parseFloat(String(row[balanceKey]).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(val)) balanceAfter = val;
    }

    if (dateStr && description && !isNaN(amount)) {
      transactions.push({
        date: dateStr,
        description,
        amount,
        type,
        category: type === TransactionType.EXPENSE ? 'Other Expense' : 'Other Income',
        notes: `Imported from Excel (${fileName})`,
        balanceAfter
      });
    }
  }

  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const lastTx = sorted[sorted.length - 1];
  const balanceDate = lastTx.date;
  const finalBalance = lastTx.balanceAfter;

  return { 
    transactions,
    finalBalance,
    balanceDate
  };
}
