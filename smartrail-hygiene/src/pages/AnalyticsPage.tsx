import React, { useState, useMemo } from 'react';
import { useApp } from '../services/AppContext';
import { 
  Star, 
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const { toilets, feedbacks, activeTrainNumber } = useApp();
  const [selectedCoach] = useState('All');

  const usageByToiletData = useMemo(() => {
    return toilets
      .filter(t => t.trainNumber === activeTrainNumber && (selectedCoach === 'All' || t.coachId === selectedCoach))
      .map(t => ({
        name: t.toiletId,
        trips: t.usageCount,
        water: t.waterLevelPercent,
        odor: t.odorLevel
      }));
  }, [toilets, activeTrainNumber, selectedCoach]);

  const issueDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    feedbacks.forEach(fb => {
      fb.issues.forEach(iss => {
        counts[iss] = (counts[iss] || 0) + 1;
      });
    });

    if (Object.keys(counts).length === 0) {
      return [
        { name: 'Foul Odor', value: 4 },
        { name: 'Low Water', value: 3 },
        { name: 'Broken Flush', value: 1 },
        { name: 'Soap Empty', value: 2 },
      ];
    }

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [feedbacks]);

  const ratingsBreakdown = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    feedbacks.forEach(fb => {
      const star = Math.max(1, Math.min(5, fb.cleanlinessRating));
      dist[star - 1] += 1;
    });

    return [
      { stars: '5 Stars', count: dist[4] },
      { stars: '4 Stars', count: dist[3] },
      { stars: '3 Stars', count: dist[2] },
      { stars: '2 Stars', count: dist[1] },
      { stars: '1 Star', count: dist[0] },
    ];
  }, [feedbacks]);

  const hourlyTrendData = [
    { hour: '06:00', avgOdor: 18, avgWater: 95 },
    { hour: '08:00', avgOdor: 32, avgWater: 85 },
    { hour: '10:00', avgOdor: 58, avgWater: 65 },
    { hour: '12:00', avgOdor: 28, avgWater: 92 },
    { hour: '14:00', avgOdor: 45, avgWater: 78 },
    { hour: '16:00', avgOdor: 62, avgWater: 52 },
    { hour: '18:00', avgOdor: 38, avgWater: 88 },
    { hour: '20:00', avgOdor: 42, avgWater: 69 },
  ];

  const PIE_COLORS = ['#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleExportCsv = () => {
    const headers = [
      'Toilet ID',
      'Coach ID',
      'Train Number',
      'Status',
      'Odor (PPM)',
      'Odor Rating',
      'Water Level (%)',
      'Usage Count',
      'Door State',
      'Sensor Online',
      'Last Cleaned'
    ];

    const rows = toilets.map(t => [
      t.toiletId,
      t.coachId,
      t.trainNumber,
      t.status,
      t.odorLevel,
      t.odorRating,
      t.waterLevelPercent,
      t.usageCount,
      t.doorState,
      t.sensorOnline ? 'Online' : 'Offline',
      `"${t.lastCleanedAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartRail_Hygiene_Report_${activeTrainNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avgCleanliness = (
    feedbacks.reduce((acc, f) => acc + f.cleanlinessRating, 0) / (feedbacks.length || 1)
  ).toFixed(1);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
              Railway Audit &amp; Intelligence
            </span>
            <span className="text-xs text-slate-500">
              Performance metrics for OBHS contractor SLA validation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Hygiene Analytics &amp; Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Historical sensor drift, usage patterns, passenger satisfaction indices, and downloadable compliance spreadsheets.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm self-start md:self-center"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Telemetry CSV Report
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Avg Cleanliness Rating</span>
          <div className="text-2xl font-black text-amber-500 font-mono mt-1 flex items-baseline gap-1">
            {avgCleanliness} <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Based on {feedbacks.length} QR scans</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Total Passenger Trips</span>
          <div className="text-2xl font-black text-slate-800 font-mono mt-1">
            {toilets.reduce((acc, t) => acc + t.usageCount, 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Active rake trip count</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Average Odor PPM</span>
          <div className="text-2xl font-black text-cyan-600 font-mono mt-1">
            {Math.round(toilets.reduce((acc, t) => acc + t.odorLevel, 0) / (toilets.length || 1))} PPM
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Threshold target &lt;45 PPM</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Avg Tank Reserve</span>
          <div className="text-2xl font-black text-sky-600 font-mono mt-1">
            {Math.round(toilets.reduce((acc, t) => acc + t.waterLevelPercent, 0) / (toilets.length || 1))}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ultrasonic level gauge</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Passenger Usage Trips by Toilet</h3>
            <p className="text-xs text-slate-500">Cumulative visit counts since last OBHS sanitation</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageByToiletData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="trips" name="Trip Visits" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">24-Hour Odor &amp; Water Telemetry Curve</h3>
            <p className="text-xs text-slate-500">Notice how odor resets each time OBHS completes cleaning</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="avgOdor" name="Odor (PPM)" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="avgWater" name="Water Level (%)" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Passenger Reported Deficiencies Breakdown</h3>
            <p className="text-xs text-slate-500">Most frequent feedback tags submitted via QR scans</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={issueDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {issueDistributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Passenger Cleanliness Satisfaction Distribution</h3>
            <p className="text-xs text-slate-500">Breakdown of 1 to 5 star ratings submitted by train travelers</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingsBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="stars" type="category" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" name="Total Reviews" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
