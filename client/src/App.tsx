import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import FleetDashboard from "./pages/FleetDashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={FleetDashboard} />
      <Route path="/dashboard" component={FleetDashboard} />
      <Route path="/dashboard/:rest*" component={FleetDashboard} />
      <Route path="/404" component={NotFound} />
      <Route component={FleetDashboard} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-left" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
