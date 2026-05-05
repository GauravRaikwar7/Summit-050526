
import * as XLSX from 'xlsx';
import { Transaction, Account, Investment, EMI, Saving, CurrencyCode } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

export const exportService = {
  exportToExcel: (
    transactions: Transaction[],
    accounts: Account[],
    investments: Investment[],
    emis: EMI[],
    savings: Saving[],
    fileName: string = 'financial_statement.xlsx'
  ) => {
    const wb = XLSX.utils.book_new();

    // Transactions Sheet
    const txData = transactions.map(tx => ({
      Date: tx.date,
      Description: tx.description,
      Amount: tx.amount,
      Type: tx.type,
      Category: tx.category,
      Account: accounts.find(a => a.id === tx.accountId)?.name || 'Unknown',
      Notes: tx.notes || ''
    }));
    const wsTx = XLSX.utils.json_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

    // Summary Sheet
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const totalInvestments = investments.reduce((sum, i) => sum + (i.quantity * i.currentPrice), 0);
    const totalSavings = savings.reduce((sum, s) => sum + s.amount, 0);
    
    const summaryData = [
      { Metric: 'Total Account Balance', Value: totalBalance },
      { Metric: 'Total Investment Value', Value: totalInvestments },
      { Metric: 'Total Savings', Value: totalSavings },
      { Metric: 'Net Worth', Value: totalBalance + totalInvestments }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Investments Sheet
    const invData = investments.map(inv => ({
      Name: inv.name,
      Symbol: inv.symbol || '',
      Type: inv.type,
      Mode: inv.mode,
      Quantity: inv.quantity,
      PurchasePrice: inv.purchasePrice,
      CurrentPrice: inv.currentPrice,
      TotalValue: inv.quantity * inv.currentPrice,
      ProfitLoss: (inv.currentPrice - inv.purchasePrice) * inv.quantity,
      SIP_Amount: inv.mode === 'SIP' ? inv.monthlyAmount : 0,
      SIP_Day: inv.mode === 'SIP' ? inv.dayOfMonth : ''
    }));
    const wsInv = XLSX.utils.json_to_sheet(invData);
    XLSX.utils.book_append_sheet(wb, wsInv, "Investments");

    // EMIs Sheet
    const emiData = emis.map(e => ({
      Name: e.name,
      Bank: e.bankName,
      MonthlyEMI: e.monthlyInstallment,
      LoanAmount: e.loanAmount,
      InterestRate: e.interestRate,
      StartDate: e.startDate,
      EndDate: e.endDate,
      LastPaidDate: e.lastPaidDate || '',
      LastPaidAmount: e.lastPaidAmount || 0
    }));
    const wsEMI = XLSX.utils.json_to_sheet(emiData);
    XLSX.utils.book_append_sheet(wb, wsEMI, "EMIs");

    // Savings Sheet
    const savingsData = savings.map(s => ({
      Name: s.name,
      Amount: s.amount,
      Date: s.date,
      Type: s.type,
      Notes: s.notes || '',
      PaidDate: s.paidDate || '',
      PaidAmount: s.paidAmount || 0
    }));
    const wsSavings = XLSX.utils.json_to_sheet(savingsData);
    XLSX.utils.book_append_sheet(wb, wsSavings, "Savings");

    XLSX.writeFile(wb, fileName);
  },

  exportToCSV: (transactions: Transaction[], fileName: string = 'transactions.csv') => {
    const txData = transactions.map(tx => ({
      Date: tx.date,
      Description: tx.description,
      Amount: tx.amount,
      Type: tx.type,
      Category: tx.category,
      Notes: tx.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(txData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportToHTML: (
    transactions: Transaction[],
    accounts: Account[],
    period: string,
    currency: CurrencyCode
  ) => {
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Summit Financial Statement - ${period}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; }
          h1 { color: #2563eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { bg-color: #f8fafc; font-weight: bold; }
          .summary { margin-bottom: 30px; padding: 20px; background: #f1f5f9; border-radius: 8px; }
          .income { color: green; font-weight: bold; }
          .expense { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Summit Financial Statement</h1>
        <p><strong>Period:</strong> ${period}</p>
        
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Balance: ${formatCurrency(totalBalance, currency)}</p>
          <p>Total Transactions in Period: ${transactions.length}</p>
        </div>

        <h2>Transaction History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td>${formatDate(tx.date)}</td>
                <td>${tx.description}</td>
                <td>${tx.category}</td>
                <td>${tx.type}</td>
                <td class="${tx.type === 'Income' ? 'income' : 'expense'}">${tx.type === 'Income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p style="margin-top: 40px; font-size: 12px; color: #666;">Generated by Summit Finance App on ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Summit_Statement_${period.replace(/\s+/g, '_')}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
