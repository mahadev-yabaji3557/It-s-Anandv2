import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Toilet, FeedbackReport, SystemSettings, AlertRecord, OdorRating, ToiletStatus } from '../types';
import { INITIAL_TOILETS, INITIAL_FEEDBACKS, INITIAL_SETTINGS, INITIAL_TRAINS } from '../data/mockData';
import { isFirebaseConfigured, subscribeToToilets, updateToiletStatusInFirebase, submitFeedbackToFirebase } from '../services/firebase';

interface AppContextType {
  toilets: Toilet[];
  feedbacks: FeedbackReport[];
  settings: SystemSettings;
  activeTrainNumber: string;
  selectedCoach: string;
  isSimulating: boolean;
  isFirebaseActive: boolean;
  lastSyncTime: string;
  setActiveTrainNumber: (trainNum: string) => void;
  setSelectedCoach: (coach: string) => void;
  setIsSimulating: (sim: boolean) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  startCleaning: (toiletId: string, staffName: string) => void;
  completeCleaning: (toiletId: string) => void;
  acknowledgeAlert: (toiletId: string, alertId: string) => void;
  resolveMaintenance: (toiletId: string, actionNote: string) => void;
  submitFeedback: (feedback: Omit<FeedbackReport, 'id' | 'timestamp' | 'status'>) => void;
  resetDemoData: () => void;
  triggerManualSensorReading: (toiletId: string, odor: number, water: number, door: 'Open' | 'Closed/Locked') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toilets, setToilets] = useState<Toilet[]>(() => {
    const saved = localStorage.getItem('smartrail_toilets');
    return saved ? JSON.parse(saved) : INITIAL_TOILETS;
  });

  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>(() => {
    const saved = localStorage.getItem('smartrail_feedbacks');
    return saved ? JSON.parse(saved) : INITIAL_FEEDBACKS;
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('smartrail_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [activeTrainNumber, setActiveTrainNumber] = useState<string>('12951');
  const [selectedCoach, setSelectedCoach] = useState<string>('All');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isFirebaseActive] = useState<boolean>(isFirebaseConfigured());
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Save changes locally
  useEffect(() => {
    localStorage.setItem('smartrail_toilets', JSON.stringify(toilets));
  }, [toilets]);

  useEffect(() => {
    localStorage.setItem('smartrail_feedbacks', JSON.stringify(feedbacks));
  }, [feedbacks]);

  useEffect(() => {
    localStorage.setItem('smartrail_settings', JSON.stringify(settings));
  }, [settings]);

  // Firebase Realtime DB subscription if configured
  useEffect(() => {
    if (!isFirebaseActive) return;
    const unsub = subscribeToToilets((firebaseData) => {
      const list = Object.values(firebaseData);
      if (list.length > 0) {
        setToilets(list);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    });
    return () => unsub();
  }, [isFirebaseActive]);

  // Autonomous Hardware & Passenger Activity Simulator
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setToilets(prevToilets => {
        return prevToilets.map(toilet => {
          if (toilet.status === 'Under Cleaning' || toilet.status === 'Out of Service') {
            return toilet;
          }

          const roll = Math.random();
          if (roll > 0.40) return toilet;

          let newStatus: ToiletStatus = toilet.status;
          let newDoor = toilet.doorState;
          let newOdor = toilet.odorLevel;
          let newWater = toilet.waterLevelPercent;
          let newUsage = toilet.usageCount;
          let newCleaningReq = toilet.cleaningRequired;
          let alerts = [...toilet.alertHistory];

          if (toilet.status === 'Available' && Math.random() < 0.25) {
            newStatus = 'Occupied';
            newDoor = 'Closed/Locked';
            newUsage += 1;
          } else if (toilet.status === 'Occupied' && Math.random() < 0.35) {
            newStatus = 'Available';
            newDoor = 'Open';
            newWater = Math.max(0, newWater - Math.floor(Math.random() * 4 + 2));
            newOdor = Math.min(100, newOdor + Math.floor(Math.random() * 8 + 3));
          } else {
            if (newStatus === 'Available' && newOdor > 15) {
              newOdor = Math.max(10, newOdor - Math.floor(Math.random() * 2 + 1));
            }
          }

          let odorRating: OdorRating = 'Good';
          if (newOdor >= settings.odorCriticalPpm) {
            odorRating = 'Critical';
          } else if (newOdor >= settings.odorWarningPpm) {
            odorRating = 'Poor';
          } else if (newOdor >= 30) {
            odorRating = 'Moderate';
          }

          if (
            newOdor >= settings.odorWarningPpm ||
            newWater <= settings.lowWaterAlertPercent ||
            newUsage >= settings.usageThresholdForCleaning
          ) {
            newCleaningReq = true;
          }

          if (newOdor >= settings.odorCriticalPpm && !alerts.some(a => a.type === 'high_odor' && !a.resolved)) {
            alerts.unshift({
              id: 'alt-' + Date.now(),
              timestamp: 'Just now',
              toiletId: toilet.toiletId,
              coachId: toilet.coachId,
              trainNumber: toilet.trainNumber,
              type: 'high_odor',
              severity: 'critical',
              message: 'Simulated MQ-135 Gas Spike: ' + newOdor + ' PPM detected. Immediate cleaning needed.',
              acknowledged: false,
              resolved: false
            });
          }

          const newHistory = [
            ...toilet.telemetryHistory.slice(-14),
            {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              odorPpm: newOdor,
              waterLevelPercent: newWater,
              doorState: newDoor
            }
          ];

          return {
            ...toilet,
            status: newStatus,
            doorState: newDoor,
            odorLevel: newOdor,
            odorRating,
            waterLevelPercent: newWater,
            usageCount: newUsage,
            cleaningRequired: newCleaningReq,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            telemetryHistory: newHistory,
            alertHistory: alerts
          };
        });
      });

      setLastSyncTime(new Date().toLocaleTimeString());
    }, settings.simulationIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [isSimulating, settings]);

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const startCleaning = (toiletId: string, staffName: string) => {
    setToilets(prev => prev.map(t => {
      if (t.toiletId === toiletId) {
        const updated: Toilet = {
          ...t,
          status: 'Under Cleaning',
          assignedStaff: staffName,
          cleaningStartedAt: new Date().toLocaleTimeString(),
          doorState: 'Closed/Locked',
          lastUpdated: new Date().toLocaleTimeString()
        };
        if (isFirebaseActive) updateToiletStatusInFirebase(toiletId, updated);
        return updated;
      }
      return t;
    }));
  };

  const completeCleaning = (toiletId: string) => {
    setToilets(prev => prev.map(t => {
      if (t.toiletId === toiletId) {
        const updatedAlerts = t.alertHistory.map(a => 
          (!a.resolved && (a.type === 'high_odor' || a.type === 'high_usage' || a.type === 'low_water'))
            ? { ...a, resolved: true, resolvedAt: new Date().toLocaleTimeString() }
            : a
        );

        const updated: Toilet = {
          ...t,
          status: 'Available',
          doorState: 'Open',
          odorLevel: 14,
          odorRating: 'Good',
          waterLevelPercent: 100,
          usageCount: 0,
          cleaningRequired: false,
          lastCleanedAt: 'Just now (' + (t.assignedStaff || 'OBHS Clean Team') + ')',
          assignedStaff: undefined,
          cleaningStartedAt: undefined,
          alertHistory: updatedAlerts,
          lastUpdated: new Date().toLocaleTimeString()
        };
        if (isFirebaseActive) updateToiletStatusInFirebase(toiletId, updated);
        return updated;
      }
      return t;
    }));
  };

  const acknowledgeAlert = (toiletId: string, alertId: string) => {
    setToilets(prev => prev.map(t => {
      if (t.toiletId === toiletId) {
        return {
          ...t,
          alertHistory: t.alertHistory.map(a => a.id === alertId ? { ...a, acknowledged: true } : a)
        };
      }
      return t;
    }));
  };

  const resolveMaintenance = (toiletId: string, actionNote: string) => {
    setToilets(prev => prev.map(t => {
      if (t.toiletId === toiletId) {
        const updatedAlerts = t.alertHistory.map(a => ({
          ...a,
          resolved: true,
          actionTaken: actionNote,
          resolvedAt: new Date().toLocaleTimeString()
        }));

        const updated: Toilet = {
          ...t,
          status: 'Available',
          doorState: 'Open',
          waterLevelPercent: t.waterLevelPercent === 0 ? 85 : t.waterLevelPercent,
          maintenanceRequired: false,
          lastMaintainedAt: 'Resolved: ' + actionNote + ' at ' + new Date().toLocaleTimeString(),
          alertHistory: updatedAlerts,
          lastUpdated: new Date().toLocaleTimeString()
        };
        if (isFirebaseActive) updateToiletStatusInFirebase(toiletId, updated);
        return updated;
      }
      return t;
    }));
  };

  const submitFeedback = (newFb: Omit<FeedbackReport, 'id' | 'timestamp' | 'status'>) => {
    const feedbackRecord: FeedbackReport = {
      ...newFb,
      id: 'fb-' + Date.now(),
      timestamp: 'Just now',
      status: 'Pending Review'
    };

    setFeedbacks(prev => [feedbackRecord, ...prev]);

    if (newFb.cleanlinessRating <= 2 || newFb.issues.length > 0) {
      setToilets(prev => prev.map(t => {
        if (t.toiletId === newFb.toiletId) {
          const alert: AlertRecord = {
            id: 'alt-' + Date.now(),
            timestamp: 'Just now',
            toiletId: t.toiletId,
            coachId: t.coachId,
            trainNumber: t.trainNumber,
            type: 'passenger_report',
            severity: newFb.cleanlinessRating === 1 ? 'critical' : 'high',
            message: 'Passenger QR Report (' + newFb.cleanlinessRating + ' stars): ' + (newFb.issues.join(', ') || 'Poor Cleanliness') + '. Note: ' + (newFb.comments || 'N/A'),
            acknowledged: false,
            resolved: false
          };
          return {
            ...t,
            cleaningRequired: true,
            alertHistory: [alert, ...t.alertHistory],
            lastUpdated: new Date().toLocaleTimeString()
          };
        }
        return t;
      }));
    }

    if (isFirebaseActive) {
      submitFeedbackToFirebase(feedbackRecord);
    }
  };

  const resetDemoData = () => {
    localStorage.removeItem('smartrail_toilets');
    localStorage.removeItem('smartrail_feedbacks');
    localStorage.removeItem('smartrail_settings');
    setToilets(INITIAL_TOILETS);
    setFeedbacks(INITIAL_FEEDBACKS);
    setSettings(INITIAL_SETTINGS);
  };

  const triggerManualSensorReading = (toiletId: string, odor: number, water: number, door: 'Open' | 'Closed/Locked') => {
    setToilets(prev => prev.map(t => {
      if (t.toiletId === toiletId) {
        return {
          ...t,
          odorLevel: odor,
          waterLevelPercent: water,
          doorState: door,
          lastUpdated: new Date().toLocaleTimeString()
        };
      }
      return t;
    }));
  };

  return (
    <AppContext.Provider
      value={{
        toilets,
        feedbacks,
        settings,
        activeTrainNumber,
        selectedCoach,
        isSimulating,
        isFirebaseActive,
        lastSyncTime,
        setActiveTrainNumber,
        setSelectedCoach,
        setIsSimulating,
        updateSettings,
        startCleaning,
        completeCleaning,
        acknowledgeAlert,
        resolveMaintenance,
        submitFeedback,
        resetDemoData,
        triggerManualSensorReading
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
