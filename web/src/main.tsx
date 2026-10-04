import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { WalletProvider } from './lib/useWallet';
import { AuthProvider } from './lib/useAuth';
import Dashboard from './pages/Dashboard';
import WalletPage from './pages/Wallet';
import Transfer from './pages/Transfer';
import Mine from './pages/Mine';
import Identity from './pages/Identity';
import Explorer from './pages/Explorer';
import Account from './pages/Account';
import Onboarding from './pages/Onboarding';
import NotFound from './pages/NotFound';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <Routes>
            <Route element={<App />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/transfer" element={<Transfer />} />
              <Route path="/mine" element={<Mine />} />
              <Route path="/identity" element={<Identity />} />
              <Route path="/explorer" element={<Explorer />} />
              <Route path="/account" element={<Account />} />
              <Route path="/welcome" element={<Onboarding />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
