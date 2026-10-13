import React, { useState } from 'react';
import { 
  CheckCircle, 
  Wind, 
  Droplets, 
  Users, 
  Wrench, 
  Sparkles, 
  X, 
  AlertTriangle, 
  History, 
  Cpu, 
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../services/AppContext';

interface ToiletDetailModalProps {
  toiletId: string | null;
  onClose: () => void;
}

export const ToiletDetailModal: React.FC<ToiletDetailModalProps> = ({ toiletId, onClose }) => {
  const { toilets, startCleaning, completeCleaning, resolveMaintenance, acknowledgeAlert, settings } = useApp();
  const [cleaningStaffInput, setCleaningStaffInput] = useState('OBHS On-Duty Team');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);

  if (!toiletId) return null;
  const toilet = toilets.find(t => t.toiletId === toiletId);
  if (!toilet) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
        <div className="bg-[#0a192f] text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {toilet.toiletId}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Train {toilet.trainNumber} • Coach {toilet.coachId} ({toilet.coachType})
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">{toilet.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
              toilet.status === 'Available' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
              toilet.status === 'Occupied' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
              toilet.status === 'Under Cleaning' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
              'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              {toilet.status}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span className="flex items-center gap-1.5"><Wind className="w-4 h-4 text-cyan-600" /> Odor (NH3/VOC)</span>
                <span className="font-bold text-slate-700">{toilet.odorRating}</span>
              </div>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {toilet.odorLevel} <span className="text-xs text-slate-400 font-normal">PPM</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Threshold: {settings.odorWarningPpm} PPM
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span className="flex items-center gap-1.5"><Droplets className="w-4 h-4 text-sky-500" /> Water Tank</span>
                <span className="font-mono font-bold text-slate-700">{toilet.waterLevelPercent}%</span>
              </div>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {Math.round(toilet.waterLevelPercent * 4.5)} <span className="text-xs text-slate-400 font-normal">Liters</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-sky-500 h-full rounded-full" 
                  style={{ width: `${toilet.waterLevelPercent}%` }} 
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Usage Since Clean
              </div>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {toilet.usageCount} <span className="text-xs text-slate-400 font-normal">/ {settings.usageThresholdForCleaning} max</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Last Clean: {toilet.lastCleanedAt}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-500" /> IoT Hardware Node
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ESP32 Node #{toilet.toiletId}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Heartbeat: {toilet.lastUpdated}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-600" /> Recent Telemetry Trend (Odor PPM &amp; Water Level %)
                </h4>
                <p className="text-xs text-slate-500">Real-time rolling sensor readings logged by ESP32 microcontroller</p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded border border-slate-200">
                Rolling Window: 15 Points
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={toilet.telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOdor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="odorPpm" name="Odor (PPM)" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorOdor)" />
                  <Area type="monotone" dataKey="waterLevelPercent" name="Water (%)" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#colorWater)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Active Alerts &amp; Incident Log
            </h4>
            {toilet.alertHistory.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                No active or historical faults logged for this toilet unit. Operating in nominal parameters.
              </div>
            ) : (
              <div className="space-y-2">
                {toilet.alertHistory.map((alt) => (
                  <div key={alt.id} className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    alt.resolved ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          alt.severity === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {alt.type.replace('_', ' ')}
                        </span>
                        <span className="text-slate-400 font-mono">{alt.timestamp}</span>
                        {alt.resolved && (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold text-[10px]">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-800">{alt.message}</p>
                      {alt.actionTaken && (
                        <p className="text-emerald-700 font-medium">Action: {alt.actionTaken}</p>
                      )}
                    </div>

                    {!alt.resolved && !alt.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(toilet.toiletId, alt.id)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 font-semibold text-rose-700 hover:bg-rose-100/50 transition"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">OBHS Housekeeping &amp; Maintenance Actions</h4>
                <p className="text-xs text-slate-500">Railway onboard cleaning &amp; repair lifecycle dispatch</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {toilet.status !== 'Under Cleaning' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cleaningStaffInput}
                    onChange={(e) => setCleaningStaffInput(e.target.value)}
                    placeholder="Staff Name / Team"
                    className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    onClick={() => startCleaning(toilet.toiletId, cleaningStaffInput)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white font-semibold text-xs hover:bg-cyan-700 transition shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Dispatch &amp; Start Cleaning
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => completeCleaning(toilet.toiletId)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Mark Sanitation Complete (Reset Counters)
                </button>
              )}

              {toilet.status === 'Out of Service' && (
                <button
                  onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition shadow-sm"
                >
                  <Wrench className="w-3.5 h-3.5" /> Resolve Mechanical Fault
                </button>
              )}
            </div>

            {showMaintenanceForm && (
              <div className="p-4 rounded-xl bg-white border border-slate-300 space-y-3 mt-3 animate-in fade-in">
                <label className="block text-xs font-semibold text-slate-700">
                  Maintenance Resolution Log / Notes
                </label>
                <input
                  type="text"
                  value={maintenanceNotes}
                  onChange={(e) => setMaintenanceNotes(e.target.value)}
                  placeholder="e.g. Solenoid valve cleared, water pressure restored, latch adjusted"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={() => {
                    resolveMaintenance(toilet.toiletId, maintenanceNotes || 'Mechanical repair verified nominal');
                    setShowMaintenanceForm(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                >
                  Confirm Repair &amp; Restore Service
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
