import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BASE_PATH } from "@/lib/site";
import { useLang } from "@/i18n";
import NotFound from "./pages/NotFound.tsx";
import DigitalLanding from "./pages/digital/DigitalLanding.tsx";
import DigitalApp from "./pages/digital/DigitalApp.tsx";
import OpsApp from "./pages/digital/ops/OpsApp.tsx";

const queryClient = new QueryClient();

const App = () => {
  // Re-render every page when the language changes.
  useLang();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={BASE_PATH || "/"}>
        <Routes>
          <Route path="/" element={<DigitalLanding />} />
          <Route path="/app/*" element={<DigitalApp />} />
          <Route path="/internal/*" element={<OpsApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
