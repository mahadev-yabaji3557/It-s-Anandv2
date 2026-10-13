import React, { useState } from 'react';
import { AppProvider } from './services/AppContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LiveMonitoringDashboard } from './pages/LiveMonitoringDashboard';
import { MaintenanceOperationsPage } from './pages/MaintenanceOperationsPage';
import { PassengerFinderPage } from './pages/PassengerFinderPage';
import { QrFeedbackPage } from './pages/QrFeedbackPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ToiletDetailModal } from './components/ToiletDetailModal';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedToiletModalId, setSelectedToiletModalId] = useState<string | null>(null);
  const [feedbackToiletTarget, setFeedbackToiletTarget] = useState<string | null>(null);

  const handleOpenFeedbackForToilet = (toiletId: string) => {
    setFeedbackToiletTarget(toiletId);
    setCurrentTab('qr-feedback');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-cyan-500 selection:text-white">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenToiletDetail={(id) => setSelectedToiletModalId(id)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {currentTab === 'home' && (
          <HomePage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'dashboard' && (
          <LiveMonitoringDashboard
            onSelectToilet={(id) => setSelectedToiletModalId(id)}
          />
        )}

        {currentTab === 'maintenance' && (
          <MaintenanceOperationsPage
            onOpenToiletDetail={(id) => setSelectedToiletModalId(id)}
          />
        )}

        {currentTab === 'passenger-finder' && (
          <PassengerFinderPage
            onSelectToilet={(id) => setSelectedToiletModalId(id)}
            onOpenFeedback={handleOpenFeedbackForToilet}
          />
        )}

        {currentTab === 'qr-feedback' && (
          <QrFeedbackPage initialToiletId={feedbackToiletTarget} />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsPage />
        )}

        {currentTab === 'settings' && (
          <SettingsPage />
        )}
      </main>

      <ToiletDetailModal
        toiletId={selectedToiletModalId}
        onClose={() => setSelectedToiletModalId(null)}
      />

      <footer className="bg-white border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-slate-800">SmartRail Hygiene</span>
            <span>•</span>
            <span>Train Toilet IoT &amp; Availability Monitoring System</span>
          </div>
          <div className="text-slate-400">
            Hardware Edge Telemetry via ESP32 • Indian Railways Transit Tech Prototype
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
