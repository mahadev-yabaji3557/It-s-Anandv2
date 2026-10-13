import React, { useState } from 'react';
import { useApp } from '../services/AppContext';
import { 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Droplets, 
  Wind, 
  ArrowRight,
  Train
} from 'lucide-react';
import { INITIAL_TRAINS } from '../data/mockData';
import { ToiletStatus } from '../types';

interface PassengerFinderPageProps {
  onSelectToilet: (toiletId: string) => void;
  onOpenFeedback: (toiletId: string) => void;
}

export const PassengerFinderPage: React.FC<PassengerFinderPageProps> = ({ onSelectToilet, onOpenFeedback }) => {
  const { toilets, activeTrainNumber, setActiveTrainNumber } = useApp();
  const [passengerCoach, setPassengerCoach] = useState('B1');

  const currentTrainToilets = toilets.filter(t => t.trainNumber === activeTrainNumber);
  const trainMeta = INITIAL_TRAINS.find(t => t.trainNumber === activeTrainNumber) || INITIAL_TRAINS[0];

  const currentCoachToilets = currentTrainToilets.filter(t => t.coachId === passengerCoach);
  const otherCoachToilets = currentTrainToilets.filter(t => t.coachId !== passengerCoach);

  const recommendedToilet = [...currentCoachToilets, ...otherCoachToilets].find(
    t => t.status === 'Available' && t.odorRating === 'Good' && t.waterLevelPercent > 30
  ) || currentTrainToilets.find(t => t.status === 'Available');

  const getStatusBadge = (status: ToiletStatus) => {
    switch (status) {
      case 'Available':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Available Now</span>;
      case 'Occupied':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-bold">Occupied</span>;
      case 'Under Cleaning':
        return <span className="bg-cyan-100 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-600 animate-spin" /> Under Cleaning</span>;
      case 'Out of Service':
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold">Out of Service</span>;
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-[#0a192f] to-[#1e3a5f] rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30">
          <Train className="w-3.5 h-3.5" /> Live Passenger Berth Assistant
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
          Find An Available Toilet Near You
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Avoid walking down crowded corridors only to wait in line. Select your train and current coach to check real-time vacant toilets, cleanliness index, and water levels.
        </p>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Train Number
            </label>
            <select
              value={activeTrainNumber}
              onChange={(e) => setActiveTrainNumber(e.target.value)}
              className="w-full bg-slate-900/90 text-white font-medium text-xs sm:text-sm p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {INITIAL_TRAINS.map(t => (
                <option key={t.trainNumber} value={t.trainNumber}>
                  {t.trainNumber} - {t.trainName} ({t.route})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Your Current Coach
            </label>
            <select
              value={passengerCoach}
              onChange={(e) => setPassengerCoach(e.target.value)}
              className="w-full bg-slate-900/90 text-white font-medium text-xs sm:text-sm p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {trainMeta.coaches.map(c => (
                <option key={c} value={c}>
                  Coach {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {recommendedToilet && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Recommended Best Option
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {recommendedToilet.name} (Coach {recommendedToilet.coachId})
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {recommendedToilet.coachId === passengerCoach 
                  ? 'Right inside your coach! Ready to use.' 
                  : 'Located in Coach ' + recommendedToilet.coachId + ' (short walk). Clean and plenty of water.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectToilet(recommendedToilet.toiletId)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            >
              View Toilet Sensor Telemetry <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-600" /> In Your Coach ({passengerCoach})
          </h2>
          <span className="text-xs text-slate-500">
            {currentCoachToilets.filter(t => t.status === 'Available').length} of {currentCoachToilets.length} available
          </span>
        </div>

        {currentCoachToilets.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            No telemetry records configured for Coach {passengerCoach}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentCoachToilets.map(toilet => (
              <div
                key={toilet.toiletId}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-900 text-white">
                      {toilet.toiletId}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">{toilet.name}</h3>
                    <p className="text-xs text-slate-400">Side: {toilet.side} of Coach {toilet.coachId}</p>
                  </div>
                  <div>
                    {getStatusBadge(toilet.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Cleanliness (Odor)</span>
                    <strong className="text-slate-800 text-sm font-bold flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-cyan-500" /> {toilet.odorRating}
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Water Level</span>
                    <strong className="text-slate-800 text-sm font-bold flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-sky-500" /> {toilet.waterLevelPercent}%
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => onSelectToilet(toilet.toiletId)}
                    className="font-semibold text-slate-700 hover:text-cyan-600 transition"
                  >
                    Details &amp; History
                  </button>

                  <button
                    onClick={() => onOpenFeedback(toilet.toiletId)}
                    className="font-bold text-cyan-600 hover:text-cyan-700 transition"
                  >
                    Report Issue / Feedback &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-bold text-slate-900">
          Nearby Coaches On This Rake
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherCoachToilets.map(toilet => (
            <div
              key={toilet.toiletId}
              className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Coach {toilet.coachId} • {toilet.toiletId}</span>
                {getStatusBadge(toilet.status)}
              </div>
              <div className="text-xs text-slate-600">
                {toilet.name}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                <span>Odor: <strong>{toilet.odorRating}</strong></span>
                <span>Water: <strong>{toilet.waterLevelPercent}%</strong></span>
                <button
                  onClick={() => onSelectToilet(toilet.toiletId)}
                  className="text-cyan-600 font-bold hover:underline"
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
