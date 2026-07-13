import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import { AdminGuard } from './components/admin/AdminGuard';

// Create TanStack Query client
const queryClient = new QueryClient();

// Lazy load pages for route-based code splitting
const LandingPage = lazy(() => import('./pages/Landing/LandingPage'));
const CustomerLogin = lazy(() => import('./routes/CustomerLogin'));
const CustomerRegister = lazy(() => import('./routes/CustomerRegister'));
const CustomerDashboard = lazy(() => import('./routes/CustomerDashboard'));
const CustomerWallet = lazy(() => import('./routes/CustomerWallet'));
const AdminConsole = lazy(() => import('./routes/admin/AdminConsole'));
const AdminLogin = lazy(() => import('./routes/admin/AdminLogin'));
const NotFound = lazy(() => import('./routes/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AdminAuthProvider>
          <CustomerAuthProvider>
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-[#121212] text-[#EBE6DF]">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                      Loading workspace...
                    </div>
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<CustomerLogin />} />
                  <Route path="/register" element={<CustomerRegister />} />
                  <Route path="/dashboard" element={<CustomerDashboard />} />
                  <Route path="/wallet" element={<CustomerWallet />} />
                  
                  {/* Admin routes */}
                  <Route path="/admin" element={<Navigate to="/admin/console" replace />} />
                  <Route
                    path="/admin/console"
                    element={
                      <AdminGuard>
                        <AdminConsole />
                      </AdminGuard>
                    }
                  />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster position="bottom-center" />
          </CustomerAuthProvider>
        </AdminAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
