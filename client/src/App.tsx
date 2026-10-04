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
      <Route path="/dashboard/vehicles" component={FleetDashboard} />
      <Route path="/dashboard/projects" component={FleetDashboard} />
      <Route path="/dashboard/maintenance" component={FleetDashboard} />
      <Route path="/dashboard/documents" component={FleetDashboard} />
      <Route path="/dashboard/drivers" component={FleetDashboard} />
      <Route path="/dashboard/employees" component={FleetDashboard} />
      <Route path="/dashboard/clients" component={FleetDashboard} />
      <Route path="/dashboard/financial" component={FleetDashboard} />
      <Route path="/dashboard/financial/:rest*" component={FleetDashboard} />
      <Route path="/dashboard/payables" component={FleetDashboard} />
      <Route path="/dashboard/reports" component={FleetDashboard} />
      <Route path="/dashboard/settings/:rest*" component={FleetDashboard} />
      <Route path="/dashboard/settings" component={FleetDashboard} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
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
