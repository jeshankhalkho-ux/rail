// src/types.ts

export interface TrainSearchResult {
  number?: string;
  name?: string;
  train_number?: string;
  train_name?: string;
  source_name?: string;
  source_code?: string;
  destination_name?: string;
  destination_code?: string;
  type?: string;
}

export interface TrainSearchResponse {
  success: boolean;
  timestamp?: number;
  data: {
    count?: number;
    results?: TrainSearchResult[];
  } | TrainSearchResult[];
}

export interface TrainScheduleStation {
  station: string;
  arrival: string | null;
  departure: string | null;
  distance: number;
  platform: string | null;
  seq: number;
}

export interface TrainScheduleResponse {
  success: boolean;
  data: {
    total_stations?: number;
    stations: TrainScheduleStation[];
  };
}

export interface TrainsBetweenItem {
  distance?: number;
  duration?: number;
  from?: { departure?: string; name?: string; code?: string };
  to?: { arrival?: string; name?: string; code?: string };
  train?: { name?: string; number?: string; type?: string };
  train_number?: string;
  train_name?: string;
  from_station_name?: string;
  to_station_name?: string;
  departure_time?: string;
  arrival_time?: string;
  duration_str?: string;
}

export interface TrainsBetweenResponse {
  success: boolean;
  data: {
    count: number;
    trains?: TrainsBetweenItem[];
    results?: TrainsBetweenItem[];
  };
}

export interface Station {
  stationCode: string;
  stationName: string;
  distance: number;
  isHalt?: boolean;
  platform?: string | null;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayArrival?: number;
  delayDeparture?: number;
  status: string;
  coachPosition?: string;
  speedToNextStationKmph?: number;
}

export interface TrainStatusResponse {
  success: boolean;
  data: {
    trainNumber: string;
    trainName: string;
    status: string;
    trackingMode?: string;
    startDate?: string;
    currentStation?: {
      stationName: string;
      stationCode: string;
    };
    train?: {
      name?: string;
      number?: string;
      avgSpeed?: number;
      maxSpeed?: number;
      category?: string;
      coachPosition?: string;
      distance?: number;
      duration?: number;
      totalHalts?: number;
      type?: string;
      source: { name: string; code: string; lat?: number; lng?: number };
      destination: { name: string; code: string; lat?: number; lng?: number };
    };
    route: Station[];
  };
}

export interface RecentLookupItem {
  id: number;
  type: "Live Status" | "Schedule" | "Between";
  number: string;
  name?: string;
  dateLabel: string;
  badge: string;
  routeShort?: string;
  progress?: number;
  fromCode?: string;
  toCode?: string;
}
