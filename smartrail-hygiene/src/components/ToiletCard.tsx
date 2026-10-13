import React from 'react';
import { Toilet, ToiletStatus, OdorRating } from '../types';
import { 
  AlertCircle, 
  Clock, 
  Droplets, 
  Wind, 
  DoorClosed, 
  DoorOpen, 
  Sparkles,
  ArrowRight,
  Wifi,
  WifiOff
} from 'lucide-react';

interface ToiletCardProps {
  toilet: Toilet;
  onSelect: (toiletId: string) => void;
  onQuickClean?: (toiletId: string) => void;
}

export const ToiletCard: React.FC<ToiletCardProps> = ({ toilet, onSelect }) => {
  const getStatusBadge = (status: ToiletStatus) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case 'Occupied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Occupied
          </span>
        );
      case 'Under Cleaning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Sparkles className="w-3 h-3 text-cyan-600 animate-spin" />
            Under Cleaning
          </span>
        );
      case 'Out of Service':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Out of Service
          </span>
        );
    }
  };

  const getOdorColor = (rating: OdorRating) => {
    switch (rating) {
      case 'Good':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'Moderate':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Poor':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Critical':
        return 'text-rose-600 bg-rose-50 border-rose-200';
    }
  };

  const getWaterColor = (percent: number) => {
    if (percent <= 20) return 'bg-rose-500';
    if (percent <= 45) return 'bg-amber-500';
    return 'bg-cyan-500';
  };

  const hasCriticalAlert = toilet.alertHistory.some(a => !a.resolved);

  return (
    <div className={`relative bg-white rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md ${
      hasCriticalAlert ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-900 text-white">
              {toilet.toiletId}
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Coach {toilet.coachId} ({toilet.coachType})
            </span>
          </div>
          <h3 className="font-bold text-slate-800 text-base mt-1 line-clamp-1">
            {toilet.name}
          </h3>
        </div>
        <div>
          {getStatusBadge(toilet.status)}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 text-sm">
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Wind className="w-3.5 h-3.5 text-slate-400" /> Odor Level
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${getOdorColor(toilet.odorRating)}`}>
              {toilet.odorRating}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-800 font-mono">{toilet.odorLevel}</span>
            <span className="text-[11px] text-slate-400 font-medium">PPM</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Droplets className="w-3.5 h-3.5 text-cyan-500" /> Water Tank
            </span>
            <span className="font-bold font-mono text-slate-700">{toilet.waterLevelPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full transition-all duration-500 ${getWaterColor(toilet.waterLevelPercent)}`}
              style={{ width: `${toilet.waterLevelPercent}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col">
          <span className="text-xs text-slate-500 font-medium mb-1">Trips Since Clean</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-800 font-mono">{toilet.usageCount}</span>
            <span className="text-[11px] text-slate-400">uses</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium mb-1">Door Latch / IoT</span>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
              {toilet.doorState === 'Closed/Locked' ? (
                <>
                  <DoorClosed className="w-3.5 h-3.5 text-amber-500" /> Locked
                </>
              ) : (
                <>
                  <DoorOpen className="w-3.5 h-3.5 text-emerald-500" /> Unlatched
                </>
              )}
            </span>
            <span title={toilet.sensorOnline ? 'Hardware telemetry active' : 'Sensor offline'}>
              {toilet.sensorOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              )}
            </span>
          </div>
        </div>
      </div>

      {toilet.cleaningRequired && (
        <div className="mx-4 mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 font-medium">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            Needs Sanitation Attention
          </span>
          {toilet.assignedStaff ? (
            <span className="text-[11px] text-amber-700 font-semibold">
              Assigned: {toilet.assignedStaff.split(' ')[0]}
            </span>
          ) : (
            <span className="text-[11px] text-rose-600 font-bold uppercase tracking-wider">
              Unassigned
            </span>
          )}
        </div>
      )}

      <div className="p-3 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" /> Updated: {toilet.lastUpdated}
        </span>

        <button
          onClick={() => onSelect(toilet.toiletId)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50/30 transition shadow-xs"
        >
          Details &amp; History <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
