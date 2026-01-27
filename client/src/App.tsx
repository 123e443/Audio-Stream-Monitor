import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import StreamDetail from "@/pages/StreamDetail";
import MapView from "@/pages/MapView";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/streams/:id" component={StreamDetail} />
      <Route path="/map" component={MapView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="scanlines" /> {/* Global Retro Effect */}
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
