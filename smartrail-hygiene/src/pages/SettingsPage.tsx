import React, { useState } from 'react';
import { useApp } from '../services/AppContext';
import { 
  Settings, 
  Sliders, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  Cpu, 
  Database
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    resetDemoData, 
    isSimulating, 
    setIsSimulating, 
    isFirebaseActive
  } = useApp();

  const [formData, setFormData] = useState({
    odorWarningPpm: settings.odorWarningPpm,
    odorCriticalPpm: settings.odorCriticalPpm,
    lowWaterAlertPercent: settings.lowWaterAlertPercent,
    usageThresholdForCleaning: settings.usageThresholdForCleaning,
    autoAlertStaff: settings.autoAlertStaff,
    soundAlerts: settings.soundAlerts,
    simulationIntervalSec: settings.simulationIntervalSec,
    activeRole: settings.activeRole
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'thresholds' | 'esp32' | 'firebase'>('thresholds');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const esp32SampleJson = `{
  "trainId": "12951",
  "coachId": "B1",
  "toiletId": "B1-T1",
  "status": "Available",
  "odorLevel": 24,          // In PPM (calibrated against MQ-135 analog pin A0)
  "odorRating": "Good",
  "waterLevelPercent": 85,  // Calculated from Ultrasonic ECHO pulse duration
  "usageCount": 4,          // Incremented when door reed switch is cycled
  "doorState": "Open",      // Read from digital pin GPIO 4 (PULLUP)
  "sensorOnline": true,
  "lastUpdated": "13:30:15"
}`;

  const firebaseRulesSample = `{
  "rules": {
    "smartrail": {
      "toilets": {
        ".read": true,
        ".write": "auth != null",
        "$toiletId": {
          ".validate": "newData.hasChildren(['status', 'odorLevel', 'waterLevelPercent'])"
        }
      },
      "feedbacks": {
        ".read": true,
        ".write": true,
        "$feedbackId": {
          ".validate": "newData.hasChildren(['toiletId', 'cleanlinessRating'])"
        }
      },
      "alerts": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}`;

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
            Configuration & Device Gateway
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          System Settings & Hardware Integration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Calibrate sensor warning thresholds, configure onboard roles, and view ESP32 firmware connection scripts.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'thresholds' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" /> Thresholds & Operational Rules
        </button>

        <button
          onClick={() => setActiveTab('esp32')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'esp32' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-4 h-4" /> ESP32 Firmware & Payload Schema
        </button>

        <button
          onClick={() => setActiveTab('firebase')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'firebase' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" /> Firebase RTDB & Security Rules
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings updated successfully! Operational rules reloaded across all coach nodes.
        </div>
      )}

      {activeTab === 'thresholds' && (
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Odor Warning Threshold (PPM)
              </label>
              <p className="text-[11px] text-slate-500">
                Triggers Moderate/Poor warning for OBHS cleaning staff.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={formData.odorWarningPpm}
                  onChange={(e) => setFormData({ ...formData, odorWarningPpm: Number(e.target.value) })}
                  className="flex-1 accent-cyan-600"
                />
                <span className="font-mono font-bold text-slate-800 text-sm px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                  {formData.odorWarningPpm} PPM
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Odor Critical Level (PPM)
              </label>
              <p className="text-[11px] text-slate-500">
                Generates high-priority audible/visual alert and priority queue jump.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={120}
                  value={formData.odorCriticalPpm}
                  onChange={(e) => setFormData({ ...formData, odorCriticalPpm: Number(e.target.value) })}
                  className="flex-1 accent-rose-600"
                />
                <span className="font-mono font-bold text-slate-800 text-sm px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                  {formData.odorCriticalPpm} PPM
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Low-Water Alert Threshold (%)
              </label>
              <p className="text-[11px] text-slate-500">
                Triggers coaching depot water refill alert before passenger runs out.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={formData.lowWaterAlertPercent}
                  onChange={(e) => setFormData({ ...formData, lowWaterAlertPercent: Number(e.target.value) })}
                  className="flex-1 accent-sky-600"
                />
                <span className="font-mono font-bold text-slate-800 text-sm px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                  {formData.lowWaterAlertPercent}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Usage Limit Before Mandatory Cleaning
              </label>
              <p className="text-[11px] text-slate-500">
                Max passenger trips allowed before automatic sanitation task creation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={formData.usageThresholdForCleaning}
                  onChange={(e) => setFormData({ ...formData, usageThresholdForCleaning: Number(e.target.value) })}
                  className="flex-1 accent-indigo-600"
                />
                <span className="font-mono font-bold text-slate-800 text-sm px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                  {formData.usageThresholdForCleaning} trips
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Autonomous Passenger & Sensor Simulator</span>
                <span className="text-[11px] text-slate-500">Simulates passenger visits, toilet flushes, and background gas decay.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isSimulating ? 'bg-cyan-600' : 'bg-slate-300'}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${isSimulating ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Automated OBHS Staff Dispatch</span>
                <span className="text-[11px] text-slate-500">Instantly queue cleaning work order upon threshold violation.</span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoAlertStaff}
                onChange={(e) => setFormData({ ...formData, autoAlertStaff: e.target.checked })}
                className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resetDemoData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset Demo Telemetry to Factory State
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
            >
              <Save className="w-4 h-4 text-cyan-400" /> Save Calibration Settings
            </button>
          </div>
        </form>
      )}

      {activeTab === 'esp32' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-600" /> ESP32 Edge Device Payload & Arduino C++ Structure
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Connect physical MQ-135, JSN-SR04T, and magnetic reed switches to an ESP32 board and publish directly to Firebase Realtime Database.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto space-y-2">
            <div className="text-cyan-400 font-bold">// ESP32 JSON Payload Specification:</div>
            <pre className="text-[11px] leading-relaxed text-slate-300">
              {esp32SampleJson}
            </pre>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm">Physical Pinout Guide for Hardware Prototype:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="block text-slate-800">MQ-135 Gas Sensor</strong>
                <span className="text-slate-500">VCC to 5V, GND to GND, AOUT to ESP32 GPIO 34 (ADC1)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="block text-slate-800">JSN-SR04T Waterproof Ultrasonic</strong>
                <span className="text-slate-500">TRIG to GPIO 5, ECHO to GPIO 18, 5V supply</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="block text-slate-800">Magnetic Door Reed Switch</strong>
                <span className="text-slate-500">Pin 1 to GPIO 4 (INPUT_PULLUP), Pin 2 to GND</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'firebase' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-600" /> Firebase Realtime Database Integration
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Production deployment security rules and configuration status.
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isFirebaseActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isFirebaseActive ? 'Connected & Live' : 'Using Local Mock Simulator'}
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm">Production Firebase Security Rules:</h4>
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto">
              <pre className="text-[11px] leading-relaxed text-slate-300">
                {firebaseRulesSample}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
