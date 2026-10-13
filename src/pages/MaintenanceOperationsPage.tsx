import React, { useState } from 'react';
import { useApp } from '../services/AppContext';
import { 
  Wrench, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  ShieldAlert, 
  Droplets, 
  Wind 
} from 'lucide-react';

interface MaintenanceOperationsPageProps {
  onOpenToiletDetail: (toiletId: string) => void;
}

export const MaintenanceOperationsPage: React.FC<MaintenanceOperationsPageProps> = ({ onOpenToiletDetail }) => {
  const { 
    toilets, 
    startCleaning, 
    completeCleaning, 
    acknowledgeAlert, 
    resolveMaintenance
  } = useApp();

  const [staffName, setStaffName] = useState('OBHS Sanitation Lead');
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'history'>('pending');

  const allAlerts = toilets.flatMap(t => t.alertHistory.map(a => ({ ...a, toiletRef: t })));

  const priorityQueue = [...toilets]
    .filter(t => t.cleaningRequired || t.maintenanceRequired || t.status === 'Out of Service' || t.status === 'Under Cleaning')
    .sort((a, b) => {
      const aScore = (a.status === 'Out of Service' ? 100 : 0) + a.odorLevel + (100 - a.waterLevelPercent);
      const bScore = (b.status === 'Out of Service' ? 100 : 0) + b.odorLevel + (100 - b.waterLevelPercent);
      return bScore - aScore;
    });

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              OBHS Operations &amp; Maintenance Center
            </span>
            <span className="text-xs text-slate-500">
              Automated Threshold Dispatches &amp; Incident Resolution
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Cleaning &amp; Maintenance Priority Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Smart queuing ranks units needing attention based on real-time MQ-135 gas sensors, ultrasonic water depletion, and passenger QR complaints.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
          <UserCheck className="w-4 h-4 text-cyan-600" />
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">On-Duty Staff:</span>
          <input
            type="text"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            className="text-xs font-semibold px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Priority Task Queue</span>
          <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {priorityQueue.filter(t => t.status !== 'Under Cleaning').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('in_progress')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'in_progress'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Currently Under Cleaning</span>
          <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {toilets.filter(t => t.status === 'Under Cleaning').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Alerts &amp; Audit Log</span>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {allAlerts.length}
          </span>
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {priorityQueue.filter(t => t.status !== 'Under Cleaning').length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">All train toilets are clean and nominal!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No toilets currently exceed odor limits, water thresholds, or usage counters. The automatic simulator will flag units as passenger traffic simulates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {priorityQueue
                .filter(t => t.status !== 'Under Cleaning')
                .map((toilet, index) => {
                  const isFault = toilet.status === 'Out of Service' || toilet.maintenanceRequired;
                  return (
                    <div
                      key={toilet.toiletId}
                      className={`p-5 rounded-2xl bg-white border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300 ${
                        isFault ? 'border-rose-300 bg-rose-50/20' : 'border-amber-200 bg-amber-50/10'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                              {toilet.toiletId}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold">
                              Coach {toilet.coachId} • Train {toilet.trainNumber}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isFault ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {toilet.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-800 text-base mt-1">{toilet.name}</h3>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                            <span className="flex items-center gap-1 font-medium">
                              <Wind className="w-3.5 h-3.5 text-cyan-600" /> Odor: <strong className="text-slate-800 font-mono">{toilet.odorLevel} PPM</strong> ({toilet.odorRating})
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-medium">
                              <Droplets className="w-3.5 h-3.5 text-sky-600" /> Water: <strong className="text-slate-800 font-mono">{toilet.waterLevelPercent}%</strong>
                            </span>
                            <span>•</span>
                            <span className="font-medium">
                              Usage: <strong className="text-slate-800 font-mono">{toilet.usageCount}</strong> trips
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onOpenToiletDetail(toilet.toiletId)}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
                        >
                          View Diagnostics
                        </button>

                        {isFault ? (
                          <button
                            onClick={() => resolveMaintenance(toilet.toiletId, 'Mechanical solenoid/valve repaired by carriage team')}
                            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Resolve Fault &amp; Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => startCleaning(toilet.toiletId, staffName)}
                            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition shadow-xs flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Dispatch &amp; Begin Cleaning
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'in_progress' && (
        <div className="space-y-4">
          {toilets.filter(t => t.status === 'Under Cleaning').length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-700">No cleaning sessions currently in progress</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Dispatch staff from the Priority Queue to begin sanitation and lock out door access.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {toilets.filter(t => t.status === 'Under Cleaning').map(toilet => (
                <div key={toilet.toiletId} className="p-5 rounded-2xl bg-white border border-cyan-200 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded border border-cyan-200">
                          {toilet.toiletId}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">Coach {toilet.coachId}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-base mt-1">{toilet.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-600" /> Assigned: <strong>{toilet.assignedStaff || 'OBHS Staff'}</strong>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" /> Cleaning In Progress
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                    <div>Cleaning Started: <strong>{toilet.cleaningStartedAt || 'Recently'}</strong></div>
                    <div>Door Status: <strong className="text-amber-600">Locked / Occupied (Safety Lock)</strong></div>
                  </div>

                  <button
                    onClick={() => completeCleaning(toilet.toiletId)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark Sanitation Completed (Reset Counters &amp; Restore Service)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> System Alerts, Sensor Spikes &amp; Passenger Feedback Log
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Total Log Entries: {allAlerts.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {allAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No historical alerts logged.</div>
            ) : (
              allAlerts.map(alt => (
                <div key={alt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        alt.severity === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        alt.severity === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {alt.type.replace('_', ' ')}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">{alt.toiletId}</span>
                      <span className="text-xs text-slate-400 font-medium">({alt.timestamp})</span>
                      {alt.resolved && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{alt.message}</p>
                    {alt.actionTaken && (
                      <p className="text-[11px] text-emerald-700 font-medium">Action logged: {alt.actionTaken}</p>
                    )}
                  </div>

                  {!alt.resolved && !alt.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alt.toiletId, alt.id)}
                      className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-50 transition"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
