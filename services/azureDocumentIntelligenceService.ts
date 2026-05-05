import { AppSettings, DocumentParseResult, RawTransaction, TransactionType } from '../types';

// --- START OF AZURE DOCUMENT INTELLIGENCE RESPONSE SIMULATION TYPES ---
// These are simplified representations of what Azure DI might return.
// In a real scenario, you'd use the Azure SDK types or more detailed interfaces.
interface AzureAnalyzeResult {
  analyzeResult?: {
    documents?: AzureDocument[];
    pages?: AzurePage[];
    tables?: AzureTable[];
    styles?: unknown[];
    contentFormat?: string;
  };
  error?: AzureError;
}

interface AzureDocument {
    docType: string;
    fields: { [key: string]: AzureField };
    confidence: number;
}

interface AzureField {
    type: string;
    valueString?: string;
    valueDate?: string;
    valueNumber?: number;
    valueArray?: AzureField[];
    valueObject?: { [key: string]: AzureField };
    content: string;
    boundingRegions?: unknown[];
    confidence?: number;
}

interface AzurePage {
  pageNumber: number;
  lines?: AzureLine[];
  words?: AzureWord[];
}

interface AzureLine {
  content: string;
  polygon?: number[];
}

interface AzureWord {
  content: string;
  polygon?: number[];
  confidence?: number;
}

interface AzureTable {
    rowCount: number;
    columnCount: number;
    cells: AzureTableCell[];
    boundingRegions?: unknown[];
}

interface AzureTableCell {
    kind: string;
    rowIndex: number;
    columnIndex: number;
    rowSpan?: number;
    columnSpan?: number;
    content: string;
    boundingRegions?: unknown[];
}

interface AzureError {
  code: string;
  message: string;
  details?: AzureError[];
}
// --- END OF AZURE DOCUMENT INTELLIGENCE RESPONSE SIMULATION TYPES ---


let currentSettings: Pick<AppSettings, 'azureDocIntelEndpoint' | 'azureDocIntelKey'> | null = null;

// Heuristic parsing logic (very simplified)
const extractTransactionsFromAzureResult = (
    azureResult: AzureAnalyzeResult, 
    fileName: string
  ): RawTransaction[] => {
  const transactions: RawTransaction[] = [];
  if (!azureResult.analyzeResult || !azureResult.analyzeResult.pages) {
    return transactions;
  }

  // Simplified strategy: Iterate through lines and try to find patterns.
  // This is highly dependent on PDF layout and will be fragile.
  // A real implementation would use table extraction, custom models, or more robust NLP.
  
  const dateRegex = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b|\b(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})\b/; // DD/MM/YYYY or YYYY/MM/DD
  const amountRegex = /([£$€]?\s?\d{1,3}(?:[,']\d{3})*\.\d{2})\b|\b(\d+\.\d{2})\b/; // Currency symbol optional, handles commas
  
  for (const page of azureResult.analyzeResult.pages) {
    if (!page.lines) continue;
    for (const line of page.lines) {
      const lineText = line.content;

      // Basic pattern: look for a date, some text, and an amount on the same line
      const dateMatch = lineText.match(dateRegex);
      const amountMatch = lineText.match(amountRegex);

      if (dateMatch && dateMatch[0] && amountMatch && amountMatch[0]) {
        let extractedDate = dateMatch[0];
        // Attempt to standardize date to YYYY-MM-DD
        try {
          const d = new Date(extractedDate.replace(/[./]/g, '-'));
          if (!isNaN(d.getTime())) {
             // Check if it's likely DD-MM-YYYY and needs reformatting
            const parts = extractedDate.split(/[./-]/);
            if (parts.length === 3 && parseInt(parts[2]) < 1000) { // Likely DD-MM-YY or DD-MM-YYYY where YY is small
                 extractedDate = `${parts[2].padStart(4, '20')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            } else if (parts.length === 3 && parseInt(parts[0]) > 1000) { // Likely YYYY-MM-DD
                 extractedDate = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
            } else { // Best guess, or could be MM-DD-YYYY
                 extractedDate = d.toISOString().split('T')[0];
            }
          } else {
            extractedDate = new Date().toISOString().split('T')[0]; // Fallback
          }
        } catch {
          extractedDate = new Date().toISOString().split('T')[0]; // Fallback
        }


        const extractedAmountStr = amountMatch[0].replace(/[^\d.]/g, '');
        const extractedAmount = parseFloat(extractedAmountStr);

        // Infer description (everything not date or amount on the line)
        let description = lineText.replace(dateMatch[0], '').replace(amountMatch[0], '').trim();
        description = description.replace(/\s\s+/g, ' ').trim() || 'Azure Imported Transaction';
        
        // Super basic type inference (needs robust keywords from actual bank statements)
        let type = TransactionType.EXPENSE;
        if (description.toLowerCase().includes('credit') || description.toLowerCase().includes('deposit') || description.toLowerCase().includes('salary')) {
          type = TransactionType.INCOME;
        } else if (description.toLowerCase().includes('debit') || description.toLowerCase().includes('payment') || description.toLowerCase().includes('withdrawal')) {
          type = TransactionType.EXPENSE;
        }
        // Else, default to Expense unless amount is clearly positive and description suggests income.

        // Basic category (fallback)
        const category = type === TransactionType.EXPENSE ? 'Other Expense' : 'Other Income';

        if (extractedAmount > 0) {
          transactions.push({
            date: extractedDate,
            description: description,
            amount: extractedAmount,
            type: type,
            category: category,
            notes: `Imported from PDF (${fileName}) via Azure DI`,
          });
        }
      }
    }
  }
  return transactions;
};


export const azureDocumentIntelligenceService = {
  configure: (settings: Pick<AppSettings, 'azureDocIntelEndpoint' | 'azureDocIntelKey'>): void => {
    if (settings.azureDocIntelEndpoint && settings.azureDocIntelKey) {
      currentSettings = settings;
      console.log("Azure Document Intelligence service configured.");
    } else {
      currentSettings = null;
      console.warn("Azure Document Intelligence service configuration cleared or incomplete.");
    }
  },

  isConfigured: (): boolean => {
    return !!currentSettings && !!currentSettings.azureDocIntelEndpoint && !!currentSettings.azureDocIntelKey;
  },

  parseTransactionsFromPdf: async (
    pdfFile: File
  ): Promise<DocumentParseResult> => {
    if (!azureDocumentIntelligenceService.isConfigured() || !currentSettings) {
      return { transactions: [], error: "Azure Document Intelligence not configured. Set Endpoint and Key in Settings." };
    }

    const { azureDocIntelEndpoint, azureDocIntelKey } = currentSettings;
    // Use the 'prebuilt-read' model for OCR, or 'prebuilt-layout' for more structure
    // For this example, we'll aim for a 'prebuilt-read' like functionality (general OCR)
    // The actual model versioning and API endpoint structure can vary. This is a generic example.
    // e.g., /formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31
    // Or for layout: /formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31
    const analyzeUrl = `${azureDocIntelEndpoint.replace(/\/$/, "")}/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31`;

    try {
      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream', // Or application/json if sending a URL to a public PDF
          'Ocp-Apim-Subscription-Key': azureDocIntelKey!,
        },
        body: pdfFile,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error("Azure DI API Error Response:", errorData);
        return { 
            transactions: [], 
            error: `Azure API Error (${response.status}): ${errorData?.error?.message || errorData.message || 'Unknown error'}` 
        };
      }

      // Azure DI usually returns an 'Operation-Location' header for polling the result.
      // For this simplified example, we'll assume the response for some models/versions might return results directly
      // or that we are simulating the final part of the polling operation.
      // A real implementation MUST handle the 202 status and polling.
      const operationLocation = response.headers.get('Operation-Location');
      if (!operationLocation) {
          // Attempt to parse directly IF the model supports synchronous response (unlikely for large PDFs)
          const directResult = await response.json() as AzureAnalyzeResult;
          if (directResult.error) {
              return { transactions: [], error: `Azure Analysis Error: ${directResult.error.code} - ${directResult.error.message}` };
          }
          // This direct path is unlikely for analyze operations, usually you get status like "succeeded" and then the analyzeResult
          // if (directResult.status === 'succeeded' && directResult.analyzeResult) { ... }
          return { transactions: [], error: "Azure DI did not return an operation location for polling, and direct result processing is not fully implemented in this example."};
      }

      // Simplified: Assume we get the result after one poll for this example
      // In reality, loop with delays until status is 'succeeded'
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate polling delay

      const resultResponse = await fetch(operationLocation, {
        method: 'GET',
        headers: { 'Ocp-Apim-Subscription-Key': azureDocIntelKey! },
      });

      if (!resultResponse.ok) {
        const errorData = await resultResponse.json().catch(() => ({ message: resultResponse.statusText }));
        return { 
            transactions: [], 
            error: `Azure Polling Error (${resultResponse.status}): ${errorData?.error?.message || errorData.message || 'Unknown error'}` 
        };
      }
      
      const analysisResult = await resultResponse.json() as AzureAnalyzeResult & {status: string};

      if (analysisResult.status !== 'succeeded') {
        return { 
            transactions: [], 
            error: `Azure analysis not successful. Status: ${analysisResult.status}. ${analysisResult.error?.message || ''}`
        };
      }
      
      if (!analysisResult.analyzeResult) {
        return { transactions: [], error: "Azure analysis succeeded but returned no result content."};
      }

      const extractedTransactions = extractTransactionsFromAzureResult(analysisResult, pdfFile.name);

      if (extractedTransactions.length === 0) {
        return { transactions: [], message: "No transactions could be heuristically extracted by Azure DI from the PDF content. The layout might be too complex for the current simplified parser." };
      }

      return { transactions: extractedTransactions };

    } catch (error) {
      console.error("Error parsing transactions from PDF with Azure DI:", error);
      let errorMessage = "Generic error during Azure DI PDF processing.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return { transactions: [], error: `Azure processing failed: ${errorMessage}` };
    }
  },
};
