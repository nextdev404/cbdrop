import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProProvider } from "./contexts/ProContext";
import { UpgradeModal } from "./components/UpgradeModal";
import { AuthModal } from "./components/AuthModal";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import { SEO_PRESETS } from "./lib/seoPresets";
import { ScrollToTop } from "./components/ScrollToTop";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}>{() => <Home />}</Route>
      <Route path={"/dashboard"} component={Dashboard} />
      {Object.entries(SEO_PRESETS).map(([key, preset]) => (
        <Route key={key} path={preset.path}>
          {() => <Home preset={preset} />}
        </Route>
      ))}
      <Route path={"/twitter-downloader"}>
        {() => <Home preset={SEO_PRESETS["x-downloader"]} />}
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

import { LanguageProvider } from "./contexts/LanguageContext";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider
          defaultTheme="dark"
          switchable
        >
          <AuthProvider>
            <ProProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
                <UpgradeModal />
                <AuthModal />
                <ScrollToTop />
                <PwaInstallPrompt />
              </TooltipProvider>
            </ProProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;


