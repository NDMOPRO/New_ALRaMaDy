import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PlatformErrorBoundary from "./components/PlatformErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { CompactModeProvider } from "./contexts/CompactModeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import SharedPresentation from "./pages/SharedPresentation";
import About from "./pages/About";
import MaterialIcon from "./components/MaterialIcon";

/** Loading spinner while checking auth */
function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center animate-fade-in">
        <MaterialIcon icon="progress_activity" size={48} className="text-primary animate-icon-spin mx-auto mb-4" />
        <p className="text-[14px] text-muted-foreground">جاري التحقق من الجلسة...</p>
      </div>
    </div>
  );
}

/** Protected route wrapper — redirects to /login if not authenticated */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

/** Admin-only route wrapper */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== 'admin') return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/shared/:token" component={SharedPresentation} />
      <Route path="/about" component={About} />
      
      {/* Protected routes */}
      <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
      <Route path="/admin">{() => <AdminRoute component={AdminPanel} />}</Route>
      <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
      
      {/* Fallback */}
      <Route>{() => <Redirect to="/" />}</Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <CompactModeProvider>
          <WorkspaceProvider>
          <NotificationProvider>
          <TooltipProvider>
            <Toaster richColors position="top-center" dir="rtl" />
            <PlatformErrorBoundary>
              <Router />
            </PlatformErrorBoundary>
          </TooltipProvider>
          </NotificationProvider>
          </WorkspaceProvider>
          </CompactModeProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
