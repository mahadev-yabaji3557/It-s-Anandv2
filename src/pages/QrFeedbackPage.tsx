import React, { useState } from 'react';
import { useApp } from '../services/AppContext';
import { 
  QrCode, 
  Star, 
  Send, 
  CheckCircle2, 
  MessageSquare
} from 'lucide-react';

interface QrFeedbackPageProps {
  initialToiletId?: string | null;
}

export const QrFeedbackPage: React.FC<QrFeedbackPageProps> = ({ initialToiletId }) => {
  const { toilets, submitFeedback, feedbacks } = useApp();

  const [selectedToiletId, setSelectedToiletId] = useState<string>(initialToiletId || (toilets[0]?.toiletId ?? 'B1-T1'));
  const [passengerName, setPassengerName] = useState('');
  const [pnr, setPnr] = useState('');
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(4);
  const [waterRating, setWaterRating] = useState<number>(4);
  const [odorRating, setOdorRating] = useState<number>(4);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const availableIssuesList = [
    'Foul Odor / Stench',
    'Low / No Water',
    'Broken Flush Lever',
    'Leaking Tap / Pipe',
    'Door Lock Defective',
    'Soap / Handwash Empty',
    'Floor Wet / Littered',
    'Mirror / Washbasin Dirty'
  ];

  const handleToggleIssue = (issue: string) => {
    if (selectedIssues.includes(issue)) {
      setSelectedIssues(selectedIssues.filter(i => i !== issue));
    } else {
      setSelectedIssues([...selectedIssues, issue]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const toilet = toilets.find(t => t.toiletId === selectedToiletId);
    if (!toilet) return;

    submitFeedback({
      trainNumber: toilet.trainNumber,
      coachId: toilet.coachId,
      toiletId: toilet.toiletId,
      passengerName: passengerName.trim() || 'Passenger',
      pnr: pnr.trim() || undefined,
      cleanlinessRating,
      waterAvailabilityRating: waterRating,
      odorRating,
      issues: selectedIssues,
      comments: comments.trim() || undefined
    });

    setIsSubmitted(true);
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
    setSelectedIssues([]);
    setComments('');
    setCleanlinessRating(4);
    setWaterRating(4);
    setOdorRating(4);
  };

  const targetToilet = toilets.find(t => t.toiletId === selectedToiletId) || toilets[0];

  return (
    <div className="space-y-6 pb-16 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 text-xs font-semibold">
          <QrCode className="w-3.5 h-3.5" /> QR Code Passenger Feedback Portal
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Rate Toilet Cleanliness &amp; Report Issues
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          Scanned from the onboard QR tag inside the coach. Your direct rating updates the railway operations dashboard and dispatches OBHS cleaners.
        </p>
      </div>

      {isSubmitted ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-md text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">Thank You for Your Feedback!</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Your report for <strong>{targetToilet.name} (Coach {targetToilet.coachId})</strong> has been saved and forwarded to the train OBHS team.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-sm mx-auto text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Toilet ID:</span>
              <strong className="font-mono">{targetToilet.toiletId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Overall Cleanliness:</span>
              <strong>{cleanlinessRating} / 5 Stars</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Issues Logged:</span>
              <strong className="text-rose-600">{selectedIssues.length > 0 ? selectedIssues.join(', ') : 'None'}</strong>
            </div>
          </div>

          <button
            onClick={handleResetForm}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition shadow-sm"
          >
            Submit Another Feedback
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Monitored Unit (Physical QR Target)
              </label>
              <span className="text-xs text-cyan-600 font-semibold font-mono">
                Live Status: {targetToilet.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Select Toilet / Coach</span>
                <select
                  value={selectedToiletId}
                  onChange={(e) => setSelectedToiletId(e.target.value)}
                  className="w-full bg-white text-slate-800 font-semibold text-xs sm:text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {toilets.map(t => (
                    <option key={t.toiletId} value={t.toiletId}>
                      {t.toiletId} - {t.name} (Coach {t.coachId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200 text-xs">
                <div className="flex-1">
                  <span className="text-slate-400 block text-[11px]">Sensor Odor Reading</span>
                  <strong className="text-slate-700 font-mono text-sm">{targetToilet.odorLevel} PPM ({targetToilet.odorRating})</strong>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex-1">
                  <span className="text-slate-400 block text-[11px]">Water Level</span>
                  <strong className="text-slate-700 font-mono text-sm">{targetToilet.waterLevelPercent}%</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Rate Hygiene Parameters</h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 gap-2">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Overall Cleanliness</span>
                <span className="text-[11px] text-slate-400">General state of floor, basin, and sanitation</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setCleanlinessRating(star)}
                    className="p-1 text-slate-300 hover:text-amber-400 transition"
                  >
                    <Star className={`w-6 h-6 ${star <= cleanlinessRating ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 gap-2">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Water Supply &amp; Tap Pressure</span>
                <span className="text-[11px] text-slate-400">Availability of flush and basin water</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setWaterRating(star)}
                    className="p-1 text-slate-300 hover:text-sky-400 transition"
                  >
                    <Star className={`w-6 h-6 ${star <= waterRating ? 'fill-sky-400 text-sky-400' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 gap-2">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Odor / Freshness</span>
                <span className="text-[11px] text-slate-400">Free from foul ammonia or sewage smells</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setOdorRating(star)}
                    className="p-1 text-slate-300 hover:text-emerald-400 transition"
                  >
                    <Star className={`w-6 h-6 ${star <= odorRating ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Report Specific Deficiencies (Select All That Apply)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableIssuesList.map(issue => {
                const isSelected = selectedIssues.includes(issue);
                return (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => handleToggleIssue(issue)}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border ${
                      isSelected
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {issue}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Passenger Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh S."
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">10-Digit PNR (Optional)</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. 2489104821"
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Comments / Note for OBHS Staff</label>
              <textarea
                rows={3}
                placeholder="Describe any other observations or requests..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-extrabold text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Submit Verified Passenger Feedback
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-600" /> Recent Passenger QR Submissions (Total: {feedbacks.length})
        </h3>

        <div className="space-y-3">
          {feedbacks.slice(0, 5).map(fb => (
            <div key={fb.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {fb.toiletId}
                  </span>
                  <span className="text-slate-500 font-medium">Coach {fb.coachId}</span>
                  <span className="text-slate-400">({fb.timestamp})</span>
                </div>
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{fb.cleanlinessRating}/5</span>
                </div>
              </div>

              {fb.issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fb.issues.map(iss => (
                    <span key={iss} className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-semibold text-[10px]">
                      {iss}
                    </span>
                  ))}
                </div>
              )}

              {fb.comments && (
                <p className="text-slate-700 italic">"{fb.comments}"</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
