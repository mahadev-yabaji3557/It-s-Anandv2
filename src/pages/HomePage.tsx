import React, { useState } from 'react';
import { 
  Train, 
  Wind, 
  Droplets, 
  ShieldCheck, 
  QrCode, 
  Sparkles, 
  Activity, 
  Search, 
  Cpu, 
  Wifi, 
  BarChart,
  Users
} from 'lucide-react';
import { useApp } from '../services/AppContext';

interface HomePageProps {
  onNavigate: (tab: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { toilets } = useApp();

  const totalToilets = toilets.length;
  const availableToilets = toilets.filter(t => t.status === 'Available').length;
  const cleanRate = Math.round((toilets.filter(t => t.odorRating === 'Good' && t.waterLevelPercent > 40).length / totalToilets) * 100);

  return (
    <div className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a192f] via-[#0f2744] to-[#1e3a5f] text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Railway Passenger Experience &amp; Sanitation
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Smart Train Toilet Hygiene &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">Availability Monitoring</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Empowering Indian Railways and transit networks with IoT sensor telemetry. Track real-time toilet availability, ammonia/odor PPM, water levels, and passenger QR feedback to streamline Onboard Housekeeping Service (OBHS).
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold text-sm shadow-lg shadow-cyan-900/40 hover:from-cyan-400 hover:to-teal-400 transition transform hover:-translate-y-0.5"
            >
              <Activity className="w-4 h-4" /> Launch Operations Dashboard
            </button>

            <button
              onClick={() => onNavigate('passenger-finder')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/90 text-slate-200 border border-slate-700 font-semibold text-sm hover:text-white hover:bg-slate-700/80 transition"
            >
              <Search className="w-4 h-4 text-cyan-400" /> Find Available Toilet
            </button>

            <button
              onClick={() => onNavigate('qr-feedback')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/90 text-slate-200 border border-slate-700 font-semibold text-sm hover:text-white hover:bg-slate-700/80 transition"
            >
              <QrCode className="w-4 h-4 text-emerald-400" /> Scan QR Feedback
            </button>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300">
          <div>
            <div className="text-xs text-slate-400 font-medium">Network Rakes Monitored</div>
            <div className="text-2xl font-bold text-white font-mono mt-0.5">3 Express Trains</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Available Toilets</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">{availableToilets} / {totalToilets}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Hygiene Compliance</div>
            <div className="text-2xl font-bold text-cyan-400 font-mono mt-0.5">{cleanRate}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Telemetry Stream</div>
            <div className="text-2xl font-bold text-teal-300 font-mono mt-0.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live 6s
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md">
            Hardware &amp; IoT Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            End-to-End Smart Train Sanitation Pipeline
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            How onboard sensors communicate seamlessly with train personnel, cloud infrastructure, and passenger dashboards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold mb-3 shadow-xs">
              <Wind className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Node Step 01</span>
            <h3 className="font-bold text-slate-800 text-base mt-0.5">Sensor Array In Toilet</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              MQ-135 detects Ammonia &amp; VOC gases. Ultrasonic JSN-SR04T monitors water level. Magnetic reed switch tracks door latch and occupancy.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold mb-3 shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Node Step 02</span>
            <h3 className="font-bold text-slate-800 text-base mt-0.5">ESP32 Edge Gateway</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Gathers analog/digital sensor readings, runs threshold outlier rejection, and buffers packets over train Wi-Fi or SIM800L GSM connectivity.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-3 shadow-xs">
              <Wifi className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Node Step 03</span>
            <h3 className="font-bold text-slate-800 text-base mt-0.5">Firebase Cloud RTDB</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              JSON document tree synchronized in sub-second latency. Dispatches automated alerts to OBHS supervisors when odor exceeds threshold or water is low.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Node Step 04</span>
            <h3 className="font-bold text-slate-800 text-base mt-0.5">Smart Operations Hub</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Cleaning staff receives priority work orders, passengers find vacant clean toilets from their berth, and station masters analyze turnaround hygiene.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Frictionless Passenger Comfort</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Passengers no longer have to walk through sway coaches only to find occupied or foul-smelling toilets. They can check live coach availability directly on their mobile browser.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Proactive OBHS Cleaning Dispatches</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Instead of arbitrary periodic cleaning, staff is deployed dynamically based on actual usage counts (e.g. &gt;15 passengers) and odor spikes, saving water and labor.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <BarChart className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Water Conservation &amp; Fault Prevention</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Instant warnings for dry water tanks and solenoid valve clogs allow coaching depots and watering halts to refill without causing passenger distress.
          </p>
        </div>
      </section>

      <section className="bg-gradient-to-r from-slate-900 to-[#0a192f] rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div>
          <h3 className="text-xl font-bold">Ready to explore the live train monitoring hub?</h3>
          <p className="text-slate-300 text-xs mt-1">
            Inspect active sensor feeds, trigger cleaning tasks, test QR feedback, or simulate real-world hardware telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 font-bold text-white text-xs transition shadow-md"
          >
            Go to Live Dashboard
          </button>
          <button
            onClick={() => onNavigate('analytics')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-slate-200 text-xs border border-slate-700 transition"
          >
            View Analytics Reports
          </button>
        </div>
      </section>
    </div>
  );
};
