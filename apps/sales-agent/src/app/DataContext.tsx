import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { AnalysisResponse } from './api';

export interface AIChartHistoryItem {
  id: string;
  prompt: string;
  chart: unknown;
  createdAt: string;
}

interface DataContextType {
  analysisData: AnalysisResponse | null;
  setAnalysisData: Dispatch<SetStateAction<AnalysisResponse | null>>;
  aiChartHistory: AIChartHistoryItem[];
  setAiChartHistory: Dispatch<SetStateAction<AIChartHistoryItem[]>>;
  pendingAiChartPrompt: string | null;
  setPendingAiChartPrompt: Dispatch<SetStateAction<string | null>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  selectedFile: File | null;
  setSelectedFile: Dispatch<SetStateAction<File | null>>;
  useDemo: boolean;
  setUseDemo: Dispatch<SetStateAction<boolean>>;
  demoDatasetName: string | null;
  setDemoDatasetName: Dispatch<SetStateAction<string | null>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [aiChartHistory, setAiChartHistory] = useState<AIChartHistoryItem[]>([]);
  const [pendingAiChartPrompt, setPendingAiChartPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useDemo, setUseDemo] = useState(true);
  const [demoDatasetName, setDemoDatasetName] = useState<string | null>(null);

  return (
    <DataContext.Provider value={{
      analysisData, setAnalysisData,
      aiChartHistory, setAiChartHistory,
      pendingAiChartPrompt, setPendingAiChartPrompt,
      isLoading, setIsLoading,
      selectedFile, setSelectedFile,
      useDemo, setUseDemo,
      demoDatasetName, setDemoDatasetName
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
