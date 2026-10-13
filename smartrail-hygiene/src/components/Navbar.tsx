import React, { useState } from 'react';
import { 
  Train, 
  LayoutDashboard, 
  Wrench, 
  Search, 
  QrCode, 
  BarChart3, 
  Settings, 
  Home, 
  Wifi, 
  WifiOff, 
  Play, 
  Pause, 
  UserCheck, 
  Menu, 
  X, 
  Droplets 
} from 'lucide-react';
import { useApp } from '../services/AppContext';
import { INITIAL_TRAINS } from '../data/mockData';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenToiletDetail?: (toiletId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { 
    isSimulating, 
    setIsSimulating, 
    isFirebaseActive, 
    lastSyncTime, 
    settings, 
    updateSettings, 
    activeTrainNumber, 
    setActiveTrainNumber,
    toilets
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const criticalAlertsCount = toilets.reduce((acc, t) => {
    return acc + t.alertHistory.filter(a => !a.resolved).length;
  }, 0);

  const navItems = [
    { id: 'home', label: 'Overview', icon: Home },
    { id: 'dashboard', label: 'Live Monitoring', icon: LayoutDashboard, badge: toilets.filter(t => t.cleaningRequired).length },
    { id: 'maintenance', label: 'Operations & Alerts', icon: Wrench, badge: criticalAlertsCount, badgeColor: 'bg-rose-500' },
    { id: 'passenger-finder', label: 'Passenger Finder', icon: Search },
    { id: 'qr-feedback', label: 'QR Feedback', icon: QrCode },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0a192f] text-white border-b border-slate-800 shadow-md">
      <div className="bg-[#071324] px-4 py-1.5 text-xs border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-slate-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            IR-IoT Telemetry Active
          </span>
          <span className="text-slate-600">|</span>
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-semibold tracking-wide">
            DEMO DATA - SIMULATED SENSORS
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1">
            {isFirebaseActive ? (
              <span className="text-emerald-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> Firebase RTDB Connected</span>
            ) : (
              <span className="text-sky-300 flex items-center gap-1"><WifiOff className="w-3 h-3 text-slate-400" /> Local IoT Mock Engine</span>
            )}
          </span>
          <span className="hidden sm:inline text-slate-400">Synced: {lastSyncTime}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400 text-[11px]">Role:</span>
            <select
              value={settings.activeRole}
              onChange={(e) => updateSettings({ activeRole: e.target.value as any })}
              className="bg-transparent text-white font-medium text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="Admin" className="bg-slate-900 text-white">Admin / Supervisor</option>
              <option value="Cleaning Staff" className="bg-slate-900 text-white">OBHS Cleaning Staff</option>
              <option value="Passenger" className="bg-slate-900 text-white">Passenger</option>
            </select>
          </div>

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
              isSimulating 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
            title="Toggle real-time background sensor drift and passenger visits"
          >
            {isSimulating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isSimulating ? 'Sim Engine Running' : 'Sim Paused'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div 
          onClick={() => setCurrentTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-950/50 p-2 border border-white/20">
            <div className="relative w-full h-full flex items-center justify-center text-white">
              <Train className="w-6 h-6 transform -rotate-6 group-hover:rotate-0 transition-transform" />
              <Droplets className="w-3 h-3 text-emerald-200 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white font-mono">SmartRail</span>
              <span className="text-lg font-bold tracking-tight text-cyan-400">Hygiene</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              Train Toilet IoT &amp; Availability Hub
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 shadow-inner">
          <Train className="w-4 h-4 text-cyan-400 mr-2" />
          <div className="flex flex-col text-left mr-2">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Monitored Rake</span>
            <select
              value={activeTrainNumber}
              onChange={(e) => setActiveTrainNumber(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-4"
            >
              {INITIAL_TRAINS.map(t => (
                <option key={t.trainNumber} value={t.trainNumber} className="bg-slate-900 text-white">
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white ${item.badgeColor || 'bg-amber-500'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0a192f] border-b border-slate-800 px-4 pt-2 pb-4 space-y-1 shadow-xl">
          <div className="mb-3 p-2 bg-slate-800/80 rounded-lg flex items-center justify-between border border-slate-700">
            <span className="text-xs text-slate-300">Select Train:</span>
            <select
              value={activeTrainNumber}
              onChange={(e) => setActiveTrainNumber(e.target.value)}
              className="bg-slate-900 text-xs font-semibold text-white px-2 py-1 rounded border border-slate-700"
            >
              {INITIAL_TRAINS.map(t => (
                <option key={t.trainNumber} value={t.trainNumber}>
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${item.badgeColor || 'bg-amber-500'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
