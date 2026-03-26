import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Users } from "lucide-react";
import { motion } from "motion/react";
import { LoadingScreen } from "./LoadingScreen";
import { useNavigate } from "react-router";
import { BackgroundGradient } from "./ui/BackgroundGradient";
import { DatasetCard } from "./DatasetCard";
import { UploadSection } from "./UploadSection";
import { Container } from "./ui/Container";
import { Section } from "./ui/Section";
import { useData } from "../DataContext";
import { analyzeDataset, warmBackend } from "../api";
import { ThemeToggle } from "./ThemeToggle";

const dummyDatasets = [
  {
    id: 1,
    name: "Walmart Sales",
    description: "Retail sales dataset for Walmart stores",
    rows: 6435,
    columns: 8,
    icon: ShoppingCart,
    file: "Walmart_Sales.csv"
  },
  {
    id: 2,
    name: "Sales Data Sample",
    description: "General sales data with multiple dimensions",
    rows: 2823,
    columns: 25,
    icon: Users,
    file: "sales_data_sample.csv"
  },
  {
    id: 3,
    name: "Demo Analytics",
    description: "Synthetic dataset for testing AI Business metrics",
    rows: 500,
    columns: 6,
    icon: TrendingUp,
    file: "demo_dataset.csv"
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { 
    isLoading, setIsLoading, 
    setAnalysisData, 
    setAiChartHistory, setPendingAiChartPrompt,
    setSelectedFile, setUseDemo, setDemoDatasetName
  } = useData();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void warmBackend();
  }, []);

  const performAnalysis = async (useDemo: boolean, demoName?: string, file?: File) => {
    setIsLoading(true);
    setError(null);
    setAiChartHistory([]);
    setPendingAiChartPrompt(null);
    try {
      const result = await analyzeDataset(useDemo, "", file, demoName);
      setAnalysisData(result);
      if (file) {
        setSelectedFile(file);
        setUseDemo(false);
        setDemoDatasetName(null);
      } else {
        setSelectedFile(null);
        setUseDemo(true);
        setDemoDatasetName(demoName || null);
      }
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze dataset");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatasetSelect = (id: number) => {
    const d = dummyDatasets.find(x => x.id === id);
    if (d) {
      performAnalysis(true, d.file);
    }
  };

  const handleFileSelect = (file: File) => {
    performAnalysis(false, undefined, file);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app-shell min-h-screen relative overflow-hidden">
      <BackgroundGradient />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <Container maxWidth="xl" className="py-12 sm:py-20 relative z-10">
        {/* Header */}
        <Section animate className="mb-12 sm:mb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Sales Agent
            </h1>
            <p className="app-subtle-text text-lg sm:text-xl max-w-2xl mx-auto px-4">
              Turn your data into actionable insights with AI
            </p>
          </div>
        </Section>

        {error && (
            <div className="mb-4 rounded bg-red-500/10 py-2 text-center text-red-500 dark:text-red-300">
              {error}
            </div>
        )}

        {/* Upload Section */}
        <Section className="mb-12 sm:mb-16">
          <UploadSection onFileSelect={handleFileSelect} />
        </Section>

        {/* Dummy Data Section */}
        <Section
          subtitle="Or try with sample data"
          animate
          delay={0.4}
        >
          <div className="grid gap-6 md:grid-cols-3">
            {dummyDatasets.map((dataset, index) => (
              <DatasetCard
                key={dataset.id}
                name={dataset.name}
                description={dataset.description}
                rows={dataset.rows}
                columns={dataset.columns}
                icon={dataset.icon}
                onSelect={() => handleDatasetSelect(dataset.id)}
                delay={0.5 + index * 0.1}
              />
            ))}
          </div>
        </Section>
      </Container>
    </div>
  );
}
