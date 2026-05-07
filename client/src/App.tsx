/* Ohio Real Estate Market Intelligence Platform
   Design: "Ohio Blueprint" — Dark navy sidebar, clean white canvas, Ohio state blue accents
   Routes: Dashboard, County Explorer, Market Trends, ML Insights, Economic Indicators, About
*/

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CountyExplorer from "./pages/CountyExplorer";
import MarketTrends from "./pages/MarketTrends";
import MLInsights from "./pages/MLInsights";
import EconomicIndicators from "./pages/EconomicIndicators";
import About from "./pages/About";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/county-explorer" component={CountyExplorer} />
        <Route path="/market-trends" component={MarketTrends} />
        <Route path="/ml-insights" component={MLInsights} />
        <Route path="/economic-indicators" component={EconomicIndicators} />
        <Route path="/about" component={About} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
