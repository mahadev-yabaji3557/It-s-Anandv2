export type ToiletStatus = 'Available' | 'Occupied' | 'Under Cleaning' | 'Out of Service';

export type OdorRating = 'Good' | 'Moderate' | 'Poor' | 'Critical';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRecord {
  id: string;
  timestamp: string;
  toiletId: string;
  coachId: string;
  trainNumber: string;
  type: 'high_odor' | 'low_water' | 'high_usage' | 'sensor_offline' | 'passenger_report' | 'fault';
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  resolved: boolean;
  assignedStaff?: string;
  actionTaken?: string;
  resolvedAt?: string;
}

export interface SensorTelemetryHistory {
  timestamp: string;
  odorPpm: number;
  waterLevelPercent: number;
  doorState: 'Open' | 'Closed/Locked';
}

export interface Toilet {
  toiletId: string; // e.g. T1 (Forward/West), T2 (Aft/East)
  name: string;
  trainId: string;
  trainNumber: string;
  trainName: string;
  coachId: string; // e.g. B1, B2, S3, A1
  coachType: 'AC 3-Tier' | 'AC 2-Tier' | 'Sleeper' | 'First AC' | 'Executive Chair Car';
  side: 'Forward' | 'Aft';
  status: ToiletStatus;
  doorState: 'Open' | 'Closed/Locked';
  odorLevel: number; // in PPM (0-100+)
  odorRating: OdorRating;
  waterLevelPercent: number; // 0 - 100%
  usageCount: number; // trips since last cleaned
  sensorOnline: boolean;
  lastUpdated: string;
  cleaningRequired: boolean;
  maintenanceRequired: boolean;
  assignedStaff?: string;
  cleaningStartedAt?: string;
  lastCleanedAt: string;
  lastMaintainedAt?: string;
  telemetryHistory: SensorTelemetryHistory[];
  alertHistory: AlertRecord[];
}

export interface FeedbackReport {
  id: string;
  timestamp: string;
  trainNumber: string;
  coachId: string;
  toiletId: string;
  passengerName?: string;
  pnr?: string;
  cleanlinessRating: number; // 1-5
  waterAvailabilityRating: number; // 1-5
  odorRating: number; // 1-5
  issues: string[]; // e.g. ['High Odor', 'Low Water', 'Broken Flush', 'Broken Tap', 'Jammed Door', 'No Soap']
  comments?: string;
  status: 'Pending Review' | 'Action Taken' | 'Resolved';
}

export interface TrainOverview {
  trainNumber: string;
  trainName: string;
  route: string;
  coaches: string[];
  totalToilets: number;
}

export interface SystemSettings {
  odorWarningPpm: number;
  odorCriticalPpm: number;
  lowWaterAlertPercent: number;
  usageThresholdForCleaning: number;
  autoAlertStaff: boolean;
  soundAlerts: boolean;
  simulationIntervalSec: number;
  activeRole: 'Admin' | 'Cleaning Staff' | 'Passenger';
}
