import React, { useState, useMemo } from 'react';
import { ToiletCard } from '../components/ToiletCard';
import { useApp } from '../services/AppContext';
import { 
  Search, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Ban
} from 'lucide-react';

interface LiveMonitoringDashboardProps {
  onSelectToilet: (toiletId: string) => void;
}

export const LiveMonitoringDashboard: React.FC<LiveMonitoringDashboardProps> = ({ onSelectToilet }) => {
  const { 
    toilets, 
    activeTrainNumber, 
    lastSyncTime 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [onlyCleaningRequired, setOnlyCleaningRequired] = useState(false);

  const trainToilets = useMemo(() => {
    return toilets.filter(t => t.trainNumber === activeTrainNumber);
  }, [toilets, activeTrainNumber]);

  const coachList = useMemo(() => {
    const set = new Set<string>();
    trainToilets.forEach(t => set.add(t.coachId));
    return ['All', ...Array.from(set)];
  }, [trainToilets]);

  const filteredToilets = useMemo(() => {
    return trainToilets.filter(t => {
      const matchSearch = 
        t.toiletId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.coachId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCoach = selectedCoach === 'All' || t.coachId === selectedCoach;
      const matchStatus = selectedStatus === 'All' || t.status === selectedStatus;
      const matchCleanReq = !onlyCleaningRequired || t.cleaningRequired;

      return matchSearch && matchCoach && matchStatus && matchCleanReq;
    });
  }, [trainToilets, searchQuery, selectedCoach, selectedStatus, onlyCleaningRequired]);

  const total = trainToilets.length;
  const available = trainToilets.filter(t => t.status === 'Available').length;
  const occupied = trainToilets.filter(t => t.status === 'Occupied').length;
  const underCleaning = trainToilets.filter(t => t.status === 'Under Cleaning').length;
  const outOfService = trainToilets.filter(t => t.status === 'Out of Service').length;
  const needsSanitation = trainToilets.filter(t => t.cleaningRequired).length;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
              Live Operations Rake #{activeTrainNumber}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> Auto-refreshing: {lastSyncTime}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Live Train Toilet Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Continuous sensor feed tracking ammonia gas PPM, water capacity, door lock status, and OBHS cleaning dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyCleaningRequired(!onlyCleaningRequired)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              onlyCleaningRequired
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Show Attention Needed ({needsSanitation})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold mb-1">Total Toilets</div>
          <div className="text-2xl font-black text-slate-800 font-mono">{total}</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">All coaches</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-xs">
          <div className="text-xs text-emerald-800 font-semibold mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Available
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{available}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Ready for use</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-xs">
          <div className="text-xs text-amber-800 font-semibold mb-1">Occupied</div>
          <div className="text-2xl font-black text-amber-700 font-mono">{occupied}</div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">In active use</div>
        </div>

        <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-200 shadow-xs">
          <div className="text-xs text-cyan-800 font-semibold mb-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> Cleaning
          </div>
          <div className="text-2xl font-black text-cyan-700 font-mono">{underCleaning}</div>
          <div className="text-[10px] text-cyan-600 font-medium mt-1">OBHS on-duty</div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-xs">
          <div className="text-xs text-rose-800 font-semibold mb-1 flex items-center gap-1">
            <Ban className="w-3.5 h-3.5 text-rose-600" /> Out of Service
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">{outOfService}</div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">Mechanical fault</div>
        </div>

        <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 shadow-xs">
          <div className="text-xs text-orange-800 font-semibold mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> Needs Clean
          </div>
          <div className="text-2xl font-black text-orange-700 font-mono">{needsSanitation}</div>
          <div className="text-[10px] text-orange-600 font-medium mt-1">Threshold reached</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search toilet ID (e.g. B1-T1), coach (B2), or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Coach:</span>
            <select
              value={selectedCoach}
              onChange={(e) => setSelectedCoach(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {coachList.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Coaches' : 'Coach ' + c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Under Cleaning">Under Cleaning</option>
              <option value="Out of Service">Out of Service</option>
            </select>
          </div>
        </div>
      </div>

      {filteredToilets.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-700">No toilets match your criteria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your search query, coach filter or status toggle.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCoach('All');
              setSelectedStatus('All');
              setOnlyCleaningRequired(false);
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredToilets.map(toilet => (
            <ToiletCard
              key={toilet.toiletId}
              toilet={toilet}
              onSelect={onSelectToilet}
            />
          ))}
        </div>
      )}
    </div>
  );
};
