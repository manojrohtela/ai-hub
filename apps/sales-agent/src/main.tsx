  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { DataProvider } from "./app/DataContext";
  import { ThemeProvider } from "./app/components/ui/theme-provider";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </ThemeProvider>
  );
