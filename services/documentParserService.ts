
import { AppSettings, PdfParserType, DocumentParseResult } from '../types';
import { azureDocumentIntelligenceService } from './azureDocumentIntelligenceService';
import { excelParserService } from './excelParserService';

let currentSettings: AppSettings | null = null;

export const documentParserService = {
  configure: (settings: AppSettings): void => {
    currentSettings = settings;
    azureDocumentIntelligenceService.configure({
      azureDocIntelEndpoint: settings.azureDocIntelEndpoint,
      azureDocIntelKey: settings.azureDocIntelKey,
    });
    console.log("Document Parser Service configured with:", settings.selectedPdfParser);
  },

  isConfigured: (parserType?: PdfParserType): boolean => {
    const typeToCheck = parserType || currentSettings?.selectedPdfParser;
    if (!typeToCheck) return false;

    if (typeToCheck === PdfParserType.AZURE) {
      return azureDocumentIntelligenceService.isConfigured();
    }
    return false;
  },

  getSelectedParser: (): PdfParserType | undefined => {
    return currentSettings?.selectedPdfParser;
  },
  
  getNotConfiguredReason: (parserType?: PdfParserType): string | null => {
    const typeToCheck = parserType || currentSettings?.selectedPdfParser;
    if (!typeToCheck) return "No parser selected.";

    if (typeToCheck === PdfParserType.AZURE && !azureDocumentIntelligenceService.isConfigured()) {
      return "Azure Document Intelligence Endpoint or Key not configured in Settings.";
    }
    return null;
  },

  parseTransactionsFromPdf: async (
    pdfFile: File
  ): Promise<DocumentParseResult> => {
    if (!currentSettings) {
      return { transactions: [], error: "Document Parser service not configured." };
    }

    const { selectedPdfParser } = currentSettings;

    if (selectedPdfParser === PdfParserType.AZURE) {
      if (!azureDocumentIntelligenceService.isConfigured()) {
        return { transactions: [], error: "Azure Document Intelligence not configured. Please set Endpoint and Key in Settings." };
      }
      return azureDocumentIntelligenceService.parseTransactionsFromPdf(pdfFile);
    } else {
      return { transactions: [], error: "No valid PDF parser selected in Settings." };
    }
  },

  parseTransactionsFromExcel: async (
    excelFile: File
  ): Promise<DocumentParseResult> => {
    return excelParserService.parseTransactions(excelFile);
  }
};

export const pdfParserService = documentParserService;
