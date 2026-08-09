import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Aliases from './pages/Aliases';
import Transfer from './pages/Transfer';
import Explorer from './pages/Explorer';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/wallet', label: 'Wallet', icon: '⛁' },
  { to: '/aliases', label: 'Aliases', icon: '◎' },
  { to: '/transfer', label: 'Transfer', icon: '↗' },
  { to: '/explorer', label: 'Explorer', icon: '⊞' },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                I
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IITkBucks</h1>
                <p className="text-xs text-gray-500">Blockchain Wallet</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <nav className="lg:w-56 shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/aliases" element={<Aliases />} />
              <Route path="/transfer" element={<Transfer />} />
              <Route path="/explorer" element={<Explorer />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
