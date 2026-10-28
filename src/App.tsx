import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Train,
  Calendar,
  Search,
  AlertCircle,
  Sun,
  Moon,
  Clock,
  Printer,
  X,
  Map,
  Coffee,
  Info,
  ShieldCheck,
  Zap,
  Gauge,
  Video,
  Box,
  Eye,
  Sunset,
  CloudRain,
  Radio,
  Check,
  ArrowRight,
  Flame,
  Sparkles,
  Loader2,
  Trash2,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { RealMotionCanvas, RakeModel, CameraMode, WeatherMode } from "./components/RealMotionCanvas";
import {
  TrainStatusResponse,
  TrainScheduleResponse,
  TrainsBetweenResponse,
  TrainSearchResult,
  RecentLookupItem,
  Station,
  TrainScheduleStation,
  TrainsBetweenItem,
} from "./types";

const INTERNAL_TOKEN = "RailSafe-Secured-Token-2024";

interface StationDetail {
  code: string;
  name: string;
  arr: string;
  dep: string;
  pf: string;
  distance?: number;
  delayArr?: number;
  delayDep?: number;
  done?: boolean;
  current?: boolean;
}

interface ActiveTelemetryState {
  number: string;
  name: string;
  routeShort: string;
  corridor: string;
  rakeModel: RakeModel;
  boardText: string;
  speed: number;
  maxSpeed: number;
  statusText: string;
  nextStation: string;
  etaText: string;
  summaryText: string;
  progressPercent: number;
  stations: StationDetail[];
  coaches: Array<{ code: string; label: string }>;
}

export default function App() {
  // Theme & Layout State
  const [palette, setPalette] = useState<"saffron" | "platinum" | "crimson" | "amethyst">("saffron");
  const [isDark, setIsDark] = useState<boolean>(true);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"live" | "schedule" | "between">("live");
  const [liveIstClock, setLiveIstClock] = useState<{ date: string; time: string }>({ date: "", time: "" });

  // Telemetry & Simulation State
  const [activeTelemetry, setActiveTelemetry] = useState<ActiveTelemetryState | null>(null);
  const [rakeModel, setRakeModel] = useState<RakeModel>("wap7-lhb");
  const [cameraMode, setCameraMode] = useState<CameraMode>("cinema");
  const [weatherMode, setWeatherMode] = useState<WeatherMode>("dusk");
  const [currentSpeed, setCurrentSpeed] = useState<number>(110);
  const [targetSpeed, setTargetSpeed] = useState<number>(110);
  const [isBraking, setIsBraking] = useState<boolean>(false);
  const [arcFlashTrigger, setArcFlashTrigger] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const [coachLabel, setCoachLabel] = useState<string>("Click any coach to inspect seating & platform boarding zone");
  const [showAllRouteStations, setShowAllRouteStations] = useState<boolean>(false);

  // Search Inputs & Autocomplete
  const [searchTrainNumber, setSearchTrainNumber] = useState<string>("");
  const [searchDate, setSearchDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<TrainSearchResult[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState<boolean>(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Station between search
  const [fromStation, setFromStation] = useState<string>("");
  const [toStation, setToStation] = useState<string>("");

  // Schedule search
  const [scheduleQueryNum, setScheduleQueryNum] = useState<string>("");

  // API State
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<{ total_stations?: number; stations: TrainScheduleStation[] } | null>(null);
  const [trainsBetweenData, setTrainsBetweenData] = useState<TrainsBetweenItem[] | null>(null);

  // Lookups & Modals (loaded purely from localStorage, no mock data)
  const [recentLookups, setRecentLookups] = useState<RecentLookupItem[]>(() => {
    try {
      const saved = localStorage.getItem("railtrack_recent_lookups");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedMapStation, setSelectedMapStation] = useState<{ name: string; code: string } | null>(null);

  // Sync recent lookups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("railtrack_recent_lookups", JSON.stringify(recentLookups));
    } catch {
      // ignore storage quota issues
    }
  }, [recentLookups]);

  // Sync Palette & Dark Mode with HTML tag
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-palette", palette);
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [palette, isDark]);

  // Sync Font Size
  useEffect(() => {
    const html = document.documentElement;
    if (fontSizeLevel === 0) html.style.fontSize = "16px";
    else if (fontSizeLevel === 1) html.style.fontSize = "17.5px";
    else if (fontSizeLevel === -1) html.style.fontSize = "14.5px";
  }, [fontSizeLevel]);

  // Live IST Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const d = String(now.getDate()).padStart(2, "0");
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = now.getFullYear();
      setLiveIstClock({
        date: `${d}-${m}-${y}`,
        time: `${timeStr} IST`,
      });
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save Recent Lookup Helper
  const saveRecentLookup = useCallback(
    (item: { type: "Live Status" | "Schedule" | "Between"; number: string; name?: string; badge: string; routeShort?: string; progress?: number }) => {
      setRecentLookups((prev) => {
        const filtered = prev.filter((x) => x.number !== item.number || x.type !== item.type);
        return [
          {
            id: Date.now(),
            type: item.type,
            number: item.number,
            name: item.name,
            dateLabel: format(new Date(), "dd MMM yyyy"),
            badge: item.badge,
            routeShort: item.routeShort,
            progress: item.progress || 60,
          },
          ...filtered,
        ].slice(0, 8);
      });
    },
    []
  );

  // Clear Recent Lookups
  const clearRecentLookups = () => {
    setRecentLookups([]);
    try {
      localStorage.removeItem("railtrack_recent_lookups");
    } catch {
      // ignore
    }
  };

  // Live API Autocomplete Search with Debounce
  useEffect(() => {
    const query = searchTrainNumber.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await fetch(`/api/railway/train/search?q=${encodeURIComponent(query)}`, {
          headers: { "x-internal-token": INTERNAL_TOKEN },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            let list: TrainSearchResult[] = [];
            if (Array.isArray(json.data)) {
              list = json.data;
            } else if (json.data.results && Array.isArray(json.data.results)) {
              list = json.data.results;
            }
            setSuggestions(list.slice(0, 8));
          } else {
            setSuggestions([]);
          }
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 280);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTrainNumber]);

  // Parse Live Status Response from Railway API
  const parseLiveStatus = useCallback((data: TrainStatusResponse["data"]) => {
    const trainInfo = data.train;
    const trainNum = data.trainNumber || trainInfo?.number || "EXPRESS";
    const trainName = data.trainName || trainInfo?.name || `Express #${trainNum}`;
    const srcCode = trainInfo?.source?.code || "";
    const srcName = trainInfo?.source?.name || "";
    const dstCode = trainInfo?.destination?.code || "";
    const dstName = trainInfo?.destination?.name || "";
    const routeShort = srcCode && dstCode ? `${srcCode} ➔ ${dstCode}` : `${trainNum} EXPRESS`;
    const corridor = srcName && dstName ? `${srcName} (${srcCode}) ➔ ${dstName} (${dstCode})` : `${trainName}`;

    // Infer best rake model based on train name / category
    let inferredRake: RakeModel = "wap7-lhb";
    const lowerName = trainName.toLowerCase();
    if (lowerName.includes("vande bharat")) {
      inferredRake = lowerName.includes("saffron") ? "vb-saffron" : "vb-white";
    } else if (lowerName.includes("gatimaan") || lowerName.includes("rajdhani") || lowerName.includes("shatabdi")) {
      inferredRake = "wap7-lhb";
    }

    // Format route stations
    const rawRoute = data.route || [];
    let departedCount = 0;
    let nextStName = "Upcoming Junction";
    let nextStPlatform = "PF #1";
    let currentFound = false;

    const mappedStations: StationDetail[] = rawRoute.map((st: Station) => {
      const isDeparted = st.status === "departed";
      if (isDeparted) departedCount++;

      const isCurrent =
        st.status === "at-station" ||
        st.status === "approaching" ||
        st.stationCode === data.currentStation?.stationCode;

      if (isCurrent && !currentFound) {
        nextStName = `${st.stationName} (${st.stationCode})`;
        nextStPlatform = st.platform ? `PF #${st.platform}` : "Main Line";
        currentFound = true;
      }

      // Format times cleanly
      const formatTimeStr = (val?: string) => {
        if (!val) return "--";
        if (val.includes("T")) {
          try {
            return format(new Date(val), "HH:mm");
          } catch {
            return val.slice(11, 16);
          }
        }
        return val;
      };

      return {
        code: st.stationCode,
        name: st.stationName,
        arr: formatTimeStr(st.actualArrival || st.scheduledArrival),
        dep: formatTimeStr(st.actualDeparture || st.scheduledDeparture),
        pf: st.platform || "1",
        distance: st.distance,
        delayArr: st.delayArrival,
        delayDep: st.delayDeparture,
        done: isDeparted,
        current: isCurrent,
      };
    });

    const totalStations = rawRoute.length || 1;
    const progressPercent = Math.min(100, Math.round((departedCount / totalStations) * 100));

    // Determine speed
    const calculatedSpeed = Math.round(trainInfo?.avgSpeed || 110);
    const maxSpeed = Math.round(trainInfo?.maxSpeed || 130);

    // Dynamic coach layout from API
    let parsedCoaches: Array<{ code: string; label: string }> = [];
    if (trainInfo?.coachPosition && typeof trainInfo.coachPosition === "string") {
      const parts = trainInfo.coachPosition.split("-").filter(Boolean);
      parsedCoaches = parts.map((part) => ({
        code: part,
        label: `${part} • Official Rake Position`,
      }));
    } else {
      parsedCoaches = [
        { code: "LOCO", label: "Aerodynamic Electric Traction Locomotive" },
        { code: "C1", label: "Air-Conditioned Chair Car • Platform Zone A" },
        { code: "C2", label: "Air-Conditioned Chair Car • Platform Zone A" },
        { code: "C3", label: "Air-Conditioned Chair Car • Platform Zone B" },
        { code: "E1", label: "Executive Class • Ergonomic 180° Seats • Zone B" },
        { code: "E2", label: "Executive Class • Pantry & Infotainment • Zone C" },
        { code: "C4", label: "Air-Conditioned Chair Car • Platform Zone C" },
        { code: "LPR", label: "Rear Luggage & Brake Generator Car" },
      ];
    }

    const telemetry: ActiveTelemetryState = {
      number: trainNum,
      name: trainName,
      routeShort,
      corridor,
      rakeModel: inferredRake,
      boardText: `${trainNum} ${trainName.toUpperCase()}`.slice(0, 38),
      speed: calculatedSpeed,
      maxSpeed,
      statusText: data.status ? `● ${data.status.toUpperCase()}` : "● ON TIME",
      nextStation: `${nextStName} • ${nextStPlatform}`,
      etaText: `OHE 25kV AC • Speed: ${calculatedSpeed} km/h`,
      summaryText: `Status: ${data.status || "Operational"} • Tracked via Official CRIS Live Feed`,
      progressPercent,
      stations: mappedStations,
      coaches: parsedCoaches,
    };

    setActiveTelemetry(telemetry);
    setRakeModel(inferredRake);
    setTargetSpeed(calculatedSpeed);
    setCurrentSpeed(calculatedSpeed);
    setIsBraking(false);
    setArcFlashTrigger((p) => p + 1);

    return telemetry;
  }, []);

  // Fetch Real Live Train Status from API
  const trackTrainLive = useCallback(
    async (trainNumber: string, dateStr?: string) => {
      const cleanNum = trainNumber.trim();
      if (!cleanNum) return;

      const cleanDate = dateStr || searchDate;
      setLoading(true);
      setApiError(null);

      try {
        const response = await fetch(`/api/railway/train/status?number=${cleanNum}&date=${cleanDate}`, {
          headers: { "x-internal-token": INTERNAL_TOKEN },
        });

        if (!response.ok) {
          throw new Error(`Railways API returned status ${response.status}`);
        }

        const resData: TrainStatusResponse = await response.json();
        if (resData.success && resData.data) {
          const tel = parseLiveStatus(resData.data);
          saveRecentLookup({
            type: "Live Status",
            number: tel.number,
            name: tel.name,
            badge: `${tel.speed} km/h`,
            routeShort: tel.routeShort,
            progress: tel.progressPercent,
          });
        } else {
          setApiError(`No live running records found for train #${cleanNum} on ${cleanDate}.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unable to reach Railway proxy";
        setApiError(`Live tracking failed: ${msg}. Check the train number and date.`);
      } finally {
        setLoading(false);
      }
    },
    [searchDate, parseLiveStatus, saveRecentLookup]
  );

  // Fetch Real Schedule from API
  const fetchTrainSchedule = useCallback(
    async (trainNum: string) => {
      const clean = trainNum.trim();
      if (!clean) return;

      setLoading(true);
      setApiError(null);
      setScheduleQueryNum(clean);

      try {
        const response = await fetch(`/api/railway/train/route?number=${clean}`, {
          headers: { "x-internal-token": INTERNAL_TOKEN },
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const resData: TrainScheduleResponse = await response.json();
        if (resData.success && resData.data) {
          setScheduleData(resData.data);
          saveRecentLookup({
            type: "Schedule",
            number: clean,
            badge: `${resData.data.total_stations || resData.data.stations.length} Halts`,
            routeShort: "Official Timetable",
            progress: 100,
          });
        } else {
          setApiError(`Schedule timetable not found for train #${clean}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setApiError(`Could not fetch schedule: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [saveRecentLookup]
  );

  // Fetch Trains Between Stations from API
  const fetchTrainsBetween = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const from = fromStation.trim().toUpperCase();
      const to = toStation.trim().toUpperCase();
      if (!from || !to) {
        setApiError("Please provide both Origin and Destination station codes.");
        return;
      }

      setLoading(true);
      setApiError(null);

      try {
        const response = await fetch(
          `/api/railway/trains/between?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${searchDate}`,
          { headers: { "x-internal-token": INTERNAL_TOKEN } }
        );
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const resData: TrainsBetweenResponse = await response.json();
        if (resData.success && resData.data) {
          const list = resData.data.trains || resData.data.results || [];
          setTrainsBetweenData(list);
          saveRecentLookup({
            type: "Between",
            number: `${from}➔${to}`,
            name: `${from} to ${to} Corridor`,
            badge: `${list.length} Trains`,
            routeShort: `${from} ➔ ${to}`,
            progress: 100,
          });
        } else {
          setApiError(`No direct trains found between ${from} and ${to}.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setApiError(`Error fetching trains between stations: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [fromStation, toStation, searchDate, saveRecentLookup]
  );

  // Initial real fetch on mount for train 12050 (real Indian Railways Gatimaan Express, not mock data!)
  useEffect(() => {
    trackTrainLive("12050");
  }, [trackTrainLive]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuggestionsOpen(false);
    if (!searchTrainNumber.trim()) return;
    trackTrainLive(searchTrainNumber, searchDate);
  };

  // Throttle & Braking Controls
  const handleThrottleChange = (val: number) => {
    setTargetSpeed(val);
    setIsBraking(val < currentSpeed - 10);
  };

  const toggleStationBrake = () => {
    if (targetSpeed > 0) {
      setIsBraking(true);
      setTargetSpeed(0);
    } else {
      setIsBraking(false);
      const cruise = activeTelemetry?.speed || 110;
      setTargetSpeed(cruise);
    }
  };

  const boostHighSpeed = () => {
    setIsBraking(false);
    setTargetSpeed(160);
    setArcFlashTrigger((p) => p + 1);
  };

  const triggerHornArc = () => {
    setArcFlashTrigger((p) => p + 1);
  };

  // Coach Inspector
  const inspectCoach = (code: string, desc: string) => {
    setCoachLabel(`Coach [${code}] — ${desc}`);
  };

  // Mouse Spotlight Effect for Recent Lookup Cards
  const updateSpotlight = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  // Filter stations based on toggle (major halts vs all route points)
  const displayedStations = activeTelemetry
    ? showAllRouteStations
      ? activeTelemetry.stations
      : activeTelemetry.stations.filter((s) => s.arr !== "--" || s.dep !== "--" || s.current || s.code === activeTelemetry.stations[0]?.code || s.code === activeTelemetry.stations[activeTelemetry.stations.length - 1]?.code)
    : [];

  return (
    <div className="min-h-screen flex flex-col ambient-backdrop text-zinc-900 dark:text-slate-100 transition-colors selection:bg-amber-500/30">
      {/* =====================================================================
           1. OFFICIAL GOVERNMENT TOP BAR + PALETTES & CLOCK
           ===================================================================== */}
      <div className="bg-[#060608] text-zinc-300 text-xs border-b border-white/10 px-3 sm:px-8 py-2 relative z-40 print:hidden">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          {/* Left: Official Ministry Identity */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex items-center gap-1.5 font-bold theme-accent-text shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Govt. Portal</span>
            </span>
            <span className="hidden sm:inline text-zinc-700">|</span>
            <span className="hidden sm:inline font-semibold text-white tracking-wide truncate">Ministry of Railways</span>
            <span className="hidden xl:inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full theme-accent-soft text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              Live CRIS 60FPS Telemetry
            </span>
          </div>

          {/* Center: 4 Executive Dark Themes (Compact swatches on mobile, labels on desktop) */}
          <div className="flex items-center gap-1 bg-zinc-900/95 p-1 rounded-xl border border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mr-1 hidden lg:inline">
              Theme:
            </span>

            <button
              onClick={() => setPalette("saffron")}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                palette === "saffron" ? "bg-white/15 text-white ring-1 ring-amber-500" : "text-zinc-400 hover:text-white"
              }`}
              title="Saffron Gold Executive Theme"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span className="hidden sm:inline">Saffron</span>
            </button>

            <button
              onClick={() => setPalette("platinum")}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                palette === "platinum" ? "bg-white/15 text-white ring-1 ring-slate-300" : "text-zinc-400 hover:text-white"
              }`}
              title="Platinum Luxury Theme"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0"></span>
              <span className="hidden sm:inline">Platinum</span>
            </button>

            <button
              onClick={() => setPalette("crimson")}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                palette === "crimson" ? "bg-white/15 text-white ring-1 ring-rose-500" : "text-zinc-400 hover:text-white"
              }`}
              title="Rajdhani Crimson Theme"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <span className="hidden sm:inline">Crimson</span>
            </button>

            <button
              onClick={() => setPalette("amethyst")}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                palette === "amethyst" ? "bg-white/15 text-white ring-1 ring-violet-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Amethyst Velvet Theme"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0"></span>
              <span className="hidden sm:inline">Amethyst</span>
            </button>
          </div>

          {/* Right: Live Clock & Contrast */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] text-zinc-300 bg-zinc-900 px-2 sm:px-2.5 py-1 rounded-lg border border-white/10 shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
              <span>
                <span className="hidden md:inline">{liveIstClock.date} • </span>
                <span>{liveIstClock.time || "Connecting IST..."}</span>
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-1 bg-zinc-900 px-1 py-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => setFontSizeLevel(-1)}
                className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                  fontSizeLevel === -1 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                A-
              </button>
              <button
                onClick={() => setFontSizeLevel(0)}
                className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                  fontSizeLevel === 0 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                A
              </button>
              <button
                onClick={() => setFontSizeLevel(1)}
                className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                  fontSizeLevel === 1 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                A+
              </button>
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition text-xs font-medium shrink-0"
              title="Toggle Light / Dark Contrast"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-amber-600" />}
              <span className="hidden sm:inline">{isDark ? "High Contrast" : "Dark Motion"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
           2. MAIN NAVIGATION HEADER
           ===================================================================== */}
      <header className="theme-surface sticky top-0 z-30 border-b px-3 sm:px-8 py-2.5 sm:py-3.5 shadow-xl print:hidden">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Brand Identity */}
            <div
              onClick={() => setActiveTab("live")}
              className="flex items-center gap-2.5 sm:gap-3.5 group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl theme-accent-bg flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 shrink-0">
                <Train className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-1 text-zinc-900 dark:text-white">
                  <span>RailTrack</span>
                  <span className="theme-accent-text font-bold">Portal</span>
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 -mt-0.5 hidden xs:block">
                  National High-Speed Telemetry & Motion Command
                </div>
              </div>
            </div>

            {/* Mobile CRIS pill */}
            <div className="flex sm:hidden items-center gap-1.5 px-2.5 py-1 rounded-full theme-accent-soft text-[10px] font-bold tracking-wider uppercase shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              <span>CRIS LIVE</span>
            </div>
          </div>

          {/* Segmented Navigation Tabs */}
          <nav className="grid grid-cols-3 sm:flex items-center p-1 sm:p-1.5 rounded-xl sm:rounded-2xl theme-elevated shadow-inner w-full md:w-auto">
            <button
              onClick={() => setActiveTab("live")}
              className={`py-2 px-2 sm:px-5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
                activeTab === "live" ? "theme-accent-bg shadow-sm" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-ping shrink-0"></span>
              <span>Live<span className="hidden sm:inline">&nbsp;Status</span></span>
            </button>
            <button
              onClick={() => {
                setActiveTab("schedule");
                if (activeTelemetry?.number && !scheduleData) {
                  fetchTrainSchedule(activeTelemetry.number);
                }
              }}
              className={`py-2 px-2 sm:px-5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
                activeTab === "schedule" ? "theme-accent-bg shadow-sm" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Schedule<span className="hidden sm:inline">&nbsp;Timetable</span></span>
            </button>
            <button
              onClick={() => setActiveTab("between")}
              className={`py-2 px-2 sm:px-5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
                activeTab === "between" ? "theme-accent-bg shadow-sm" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span>Between<span className="hidden sm:inline">&nbsp;Trains</span></span>
            </button>
          </nav>

          {/* Right Status Pill (Desktop only) */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-xl theme-elevated text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Telemetry Feed:</span>
              <span className="font-mono font-bold theme-accent-text">LIVE API ACTIVE</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="text-zinc-500 dark:text-zinc-400">Engine:</span>
              <span className="font-mono font-bold theme-accent-text">{fps} FPS</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full theme-accent-soft text-xs font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              <span>CRIS SECURE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Error Banner if API error occurs */}
      {apiError && (
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 pt-4">
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-rose-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
           3. MAIN EXECUTIVE DASHBOARD CONTAINER
           ===================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-7">
        <div className="theme-surface rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 lg:p-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-start">
            {/* ===============================================================
                 LEFT COLUMN (8 COLS):
                 1. 60FPS Real Motion HTML5 Canvas Viewport
                 2. Search Command Center & Autocomplete
                 3. Live Corridor Station Progression & Coach Composition
                 =============================================================== */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              {/* 1A. REAL-MOTION 60FPS CANVAS VIEWPORT */}
              <div className="rounded-2xl bg-[#070709] border border-white/10 overflow-hidden shadow-2xl relative">
                {/* Top HUD Bar */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-zinc-950/95 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 relative z-20">
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg theme-accent-bg font-mono font-extrabold text-[11px] sm:text-xs shrink-0">
                        {activeTelemetry?.number || "EXPRESS"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h2 className="text-white font-bold text-xs sm:text-base tracking-tight truncate">
                            {activeTelemetry?.name || "Locomotive Live Telemetry"}
                          </h2>
                          {activeTelemetry && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold theme-accent-soft shrink-0">
                              {activeTelemetry.statusText}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-[11px] font-mono text-zinc-400 truncate">
                          {activeTelemetry?.corridor || "CRIS Real-Time Railway Telemetry Core"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Model Switcher & Camera Switcher */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
                    {/* Rake Model Switcher */}
                    <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 sm:p-1 rounded-xl border border-white/10 shrink-0">
                      <button
                        onClick={() => setRakeModel("vb-saffron")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          rakeModel === "vb-saffron" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="Vande Bharat 2.0 Saffron-Grey"
                      >
                        <Train className="w-3 h-3 shrink-0" />
                        <span>Saffron<span className="hidden md:inline">&nbsp;2.0</span></span>
                      </button>
                      <button
                        onClick={() => setRakeModel("vb-white")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          rakeModel === "vb-white" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="Vande Bharat Classic Pearl White"
                      >
                        <Train className="w-3 h-3 shrink-0" />
                        <span>Pearl<span className="hidden md:inline">&nbsp;White</span></span>
                      </button>
                      <button
                        onClick={() => setRakeModel("wap7-lhb")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          rakeModel === "wap7-lhb" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="WAP-7 Electric Loco + LHB Rajdhani"
                      >
                        <Zap className="w-3 h-3 shrink-0" />
                        <span>WAP-7<span className="hidden md:inline">&nbsp;+ LHB</span></span>
                      </button>
                    </div>

                    {/* Camera Angle Switcher */}
                    <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 sm:p-1 rounded-xl border border-white/10 shrink-0">
                      <button
                        onClick={() => setCameraMode("cinema")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          cameraMode === "cinema" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="Real Train 3/4 Camera Angle"
                      >
                        <Video className="w-3 h-3 shrink-0" />
                        <span>3/4 Cam</span>
                      </button>
                      <button
                        onClick={() => setCameraMode("chase")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          cameraMode === "chase" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="3D Corridor Overhead Perspective"
                      >
                        <Box className="w-3 h-3 shrink-0" />
                        <span>Corridor</span>
                      </button>
                      <button
                        onClick={() => setCameraMode("cockpit")}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition flex items-center gap-1 ${
                          cameraMode === "cockpit" ? "theme-accent-bg" : "text-zinc-400 hover:text-white"
                        }`}
                        title="Loco Pilot Cab Desk POV"
                      >
                        <Eye className="w-3 h-3 shrink-0" />
                        <span>Cab POV</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canvas Display Viewport */}
                <div className="relative h-64 sm:h-72 lg:h-[340px] w-full bg-[#060608] overflow-hidden select-none">
                  <RealMotionCanvas
                    rakeModel={rakeModel}
                    cameraMode={cameraMode}
                    weatherMode={weatherMode}
                    currentSpeed={currentSpeed}
                    targetSpeed={targetSpeed}
                    isBraking={isBraking}
                    arcFlashTrigger={arcFlashTrigger}
                    boardText={activeTelemetry?.boardText || "INDIAN RAILWAYS LIVE TELEMETRY"}
                    onFpsUpdate={setFps}
                    onSpeedStep={setCurrentSpeed}
                  />

                  {/* Top-Left Telemetry Overlay */}
                  <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-4 z-10 pointer-events-none flex items-center gap-2">
                    <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-2 sm:gap-3 font-mono shadow-lg">
                      <div>
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-widest text-zinc-400">Velocity</div>
                        <div className="text-sm sm:text-lg font-extrabold theme-accent-text leading-tight">
                          <span>{Math.round(currentSpeed)}</span>{" "}
                          <span className="text-[10px] sm:text-xs font-normal text-zinc-400">km/h</span>
                        </div>
                      </div>
                      <div className="hidden xs:block h-5 sm:h-6 w-[1px] bg-white/15"></div>
                      <div className="hidden xs:block">
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-widest text-zinc-400">Station</div>
                        <div className="text-[11px] sm:text-xs font-bold text-amber-200 truncate max-w-[120px] sm:max-w-[200px]">
                          {activeTelemetry?.nextStation || "Main Line Signal Operational"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weather Mode Switcher */}
                  <div className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-4 z-10 flex items-center gap-0.5 sm:gap-1 bg-black/75 backdrop-blur-md p-0.5 sm:p-1 rounded-xl border border-white/10 text-[10px] sm:text-[11px] shadow-lg">
                    <button
                      onClick={() => setWeatherMode("dusk")}
                      className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        weatherMode === "dusk" ? "bg-white/20 text-amber-300" : "text-zinc-400 hover:text-white"
                      }`}
                      title="Golden Dusk Atmosphere"
                    >
                      <Sunset className="w-3 h-3 shrink-0" />
                      <span className="hidden xs:inline">Dusk</span>
                    </button>
                    <button
                      onClick={() => setWeatherMode("rain")}
                      className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        weatherMode === "rain" ? "bg-white/20 text-amber-300" : "text-zinc-400 hover:text-white"
                      }`}
                      title="Midnight Monsoon Rain"
                    >
                      <CloudRain className="w-3 h-3 shrink-0" />
                      <span className="hidden xs:inline">Rain</span>
                    </button>
                    <button
                      onClick={() => setWeatherMode("twilight")}
                      className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        weatherMode === "twilight" ? "bg-white/20 text-amber-300" : "text-zinc-400 hover:text-white"
                      }`}
                      title="Crimson Night Vision"
                    >
                      <Moon className="w-3 h-3 shrink-0" />
                      <span className="hidden xs:inline">Night</span>
                    </button>
                  </div>

                  {/* Floating Bottom Callout (hidden on mobile) */}
                  <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-4 z-10 pointer-events-none hidden sm:flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      <span className="text-amber-300 font-bold">3D REAL MOTION TELEMETRY</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-300">{activeTelemetry?.etaText || "OHE 25kV Catenary Locked"}</span>
                    </div>
                  </div>
                </div>

                {/* Throttle & Brake Control Bar */}
                <div className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-zinc-950 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs text-zinc-300">
                  <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1 shrink-0">
                      <Gauge className="w-3.5 h-3.5 theme-accent-text" />
                      Throttle:
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="160"
                      value={targetSpeed}
                      onChange={(e) => handleThrottleChange(parseInt(e.target.value, 10))}
                      className="flex-1 sm:w-36 accent-amber-500 cursor-pointer h-2"
                    />
                    <span className="font-mono text-xs font-bold theme-accent-text shrink-0 w-14 text-right">
                      {targetSpeed} km/h
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                    <button
                      onClick={toggleStationBrake}
                      className="px-2 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[auto] rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 font-semibold text-[11px] transition flex items-center justify-center gap-1 text-center"
                    >
                      <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{targetSpeed === 0 ? "Launch" : "Brake"}</span>
                    </button>

                    <button
                      onClick={boostHighSpeed}
                      className="px-2 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[auto] rounded-lg theme-accent-soft font-bold text-[11px] transition flex items-center justify-center gap-1 hover:opacity-90 text-center"
                    >
                      <Zap className="w-3 h-3 shrink-0" />
                      <span>160 Boost</span>
                    </button>

                    <button
                      onClick={triggerHornArc}
                      className="px-2 sm:px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[auto] rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 font-semibold text-[11px] transition flex items-center justify-center gap-1 text-center"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                      <span>Arc Flash</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1B. LIVE STATUS SEARCH COMMAND CENTER */}
              {activeTab === "live" && (
                <div className="space-y-6">
                  {/* Search Card */}
                  <div className="p-4 sm:p-6 rounded-2xl theme-elevated space-y-3.5 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Track Live Status</h1>
                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                          Enter a train number or name to fetch official real-time running coordinates and telemetry.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 rounded-full theme-accent-soft text-[10px] sm:text-xs font-mono font-bold shrink-0">
                        DIRECT CRIS PROXY • ZERO MOCK
                      </span>
                    </div>

                    {/* Search Row */}
                    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 relative">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-accent-text pointer-events-none" />
                        <input
                          type="text"
                          value={searchTrainNumber}
                          onFocus={() => setIsSuggestionsOpen(true)}
                          onChange={(e) => {
                            setSearchTrainNumber(e.target.value);
                            setIsSuggestionsOpen(true);
                          }}
                          placeholder="Train Number or Name (e.g. 12050, 22436, Gatimaan)"
                          className="w-full pl-10 pr-10 py-3 sm:py-3.5 rounded-xl theme-input text-base sm:text-sm font-semibold min-h-[48px] text-zinc-900 dark:text-white placeholder:text-zinc-500"
                        />
                        {isSearchingSuggestions && (
                          <Loader2 className="w-4 h-4 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 opacity-50 text-zinc-700 dark:text-zinc-300" />
                        )}

                        {/* Real Dynamic Autocomplete Suggestions Dropdown from live Railway API */}
                        {isSuggestionsOpen && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl theme-surface shadow-2xl border border-zinc-200 dark:border-white/15 z-40 overflow-hidden divide-y divide-zinc-200 dark:divide-white/5 max-h-64 overflow-y-auto">
                            {suggestions.map((t, idx) => {
                              const tNum = t.number || t.train_number || "";
                              const tName = t.name || t.train_name || "";
                              const src = t.source_code || "";
                              const dst = t.destination_code || "";

                              return (
                                <div
                                  key={`${tNum}-${idx}`}
                                  onClick={() => {
                                    setIsSuggestionsOpen(false);
                                    setSearchTrainNumber(tNum);
                                    trackTrainLive(tNum);
                                  }}
                                  className="px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer flex items-center justify-between text-xs transition"
                                >
                                  <div>
                                    <span className="font-mono font-bold theme-accent-text mr-2">{tNum}</span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">{tName}</span>
                                  </div>
                                  {src && dst && (
                                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                      {src} ➔ {dst}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="relative w-full sm:w-48">
                        <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-accent-text pointer-events-none" />
                        <input
                          type="date"
                          value={searchDate}
                          onChange={(e) => setSearchDate(e.target.value)}
                          className="w-full pl-10 pr-3 py-3 sm:py-3.5 rounded-xl theme-input text-base sm:text-sm font-mono min-h-[48px] text-zinc-900 dark:text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-executive theme-accent-bg w-full sm:w-auto px-7 py-3 sm:py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50 min-h-[48px]"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                        <span>{loading ? "Fetching..." : "Track Train"}</span>
                      </button>
                    </form>

                    {/* Popular Corridor Queries (invoke real API on click) */}
                    <div className="pt-1 flex items-center gap-2 text-xs overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
                      <span className="text-zinc-600 dark:text-zinc-400 font-semibold mr-1 shrink-0">Direct Query:</span>
                      <button
                        onClick={() => {
                          setSearchTrainNumber("12050");
                          trackTrainLive("12050");
                        }}
                        className="px-3 py-1.5 rounded-xl theme-surface border border-zinc-200 dark:border-white/10 hover:border-amber-500/50 transition font-mono flex items-center gap-1.5 shrink-0 min-h-[38px] text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-white/5"
                      >
                        <span className="theme-accent-text font-bold">12050</span>
                        <span className="font-sans text-zinc-700 dark:text-zinc-300">Gatimaan Express</span>
                      </button>
                      <button
                        onClick={() => {
                          setSearchTrainNumber("22436");
                          trackTrainLive("22436");
                        }}
                        className="px-3 py-1.5 rounded-xl theme-surface border border-zinc-200 dark:border-white/10 hover:border-amber-500/50 transition font-mono flex items-center gap-1.5 shrink-0 min-h-[38px] text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-white/5"
                      >
                        <span className="theme-accent-text font-bold">22436</span>
                        <span className="font-sans text-zinc-700 dark:text-zinc-300">Vande Bharat</span>
                      </button>
                      <button
                        onClick={() => {
                          setSearchTrainNumber("12952");
                          trackTrainLive("12952");
                        }}
                        className="px-3 py-1.5 rounded-xl theme-surface border border-zinc-200 dark:border-white/10 hover:border-amber-500/50 transition font-mono flex items-center gap-1.5 shrink-0 min-h-[38px] text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-white/5"
                      >
                        <span className="theme-accent-text font-bold">12952</span>
                        <span className="font-sans text-zinc-700 dark:text-zinc-300">Mumbai Rajdhani</span>
                      </button>
                    </div>
                  </div>

                  {/* 1C. LIVE CORRIDOR STATION PROGRESSION & RAKE COMPOSITION */}
                  {activeTelemetry && (
                    <div className="p-4 sm:p-6 rounded-2xl theme-elevated space-y-4 sm:space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full theme-accent-bg animate-ping shrink-0"></span>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Live Corridor Station Progression
                          </h3>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            onClick={() => setShowAllRouteStations(!showAllRouteStations)}
                            className="text-xs font-mono px-2.5 py-1 rounded-lg theme-surface hover:opacity-90 transition text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 min-h-[34px]"
                          >
                            {showAllRouteStations ? "Showing All Points" : "Showing Major Halts"}
                          </button>
                          <span className="text-[11px] sm:text-xs font-mono theme-accent-text font-semibold truncate max-w-[200px] sm:max-w-none">
                            {activeTelemetry.summaryText}
                          </span>
                        </div>
                      </div>

                      {/* Horizontal Station Stepper */}
                      {displayedStations.length > 0 ? (
                        <div className="overflow-x-auto pb-3 -mx-2 px-2 scrollbar-none">
                          <div className="min-w-[560px] sm:min-w-[640px] flex items-start justify-between pt-3">
                            {displayedStations.map((st, idx) => (
                              <div
                                key={`${st.code}-${idx}`}
                                onClick={() => setSelectedMapStation({ name: st.name, code: st.code })}
                                className="flex-1 flex flex-col items-center relative cursor-pointer group px-1 min-h-[44px]"
                                title="Click to view station schematic map & amenities"
                              >
                                {idx < displayedStations.length - 1 && (
                                  <div
                                    className={`absolute top-3.5 left-1/2 w-full h-1 ${
                                      st.done ? "theme-accent-bg" : "bg-zinc-200 dark:bg-zinc-800"
                                    }`}
                                  ></div>
                                )}

                                <div
                                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110 shrink-0 ${
                                    st.current
                                      ? "theme-accent-bg ring-4 ring-amber-500/30 animate-bounce"
                                      : st.done
                                      ? "theme-accent-soft"
                                      : "bg-zinc-100 text-zinc-600 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                  }`}
                                >
                                  {st.current ? (
                                    <Train className="w-3.5 h-3.5" />
                                  ) : st.done ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    idx + 1
                                  )}
                                </div>

                                <div className="mt-2 text-center">
                                  <div className={`font-mono font-bold text-xs ${st.current ? "theme-accent-text" : "text-zinc-900 dark:text-zinc-100"}`}>
                                    {st.code}
                                  </div>
                                  <div className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[85px] sm:max-w-[90px]">{st.name}</div>
                                  <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                                    {st.dep !== "--" ? st.dep : st.arr} • PF {st.pf}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-zinc-500 dark:text-zinc-400">
                          Route stations will display once telemetry is active.
                        </div>
                      )}

                      {/* Interactive Real Coach Composition Strip */}
                      <div className="pt-3.5 border-t border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs">
                          <span className="font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Coach Inspector:</span>
                          <span className="ml-2 font-mono theme-accent-text font-bold">{coachLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                          {activeTelemetry.coaches.map((c, i) => (
                            <button
                              key={`${c.code}-${i}`}
                              onClick={() => inspectCoach(c.code, c.label)}
                              className={`min-w-[38px] min-h-[36px] px-2.5 py-1 rounded-md font-mono text-[11px] shrink-0 transition flex items-center justify-center ${
                                c.code.includes("ENG") || c.code.includes("LOCO")
                                  ? "theme-accent-bg font-extrabold"
                                  : c.code.startsWith("E")
                                  ? "theme-accent-soft font-bold"
                                  : "theme-surface text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10"
                              }`}
                            >
                              {c.code}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SCHEDULE VIEW (Pure real data fetched from /api/railway/train/route) */}
              {activeTab === "schedule" && (
                <div className="p-4 sm:p-6 rounded-2xl theme-elevated space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white">
                        Official Route Timetable —{" "}
                        <span className="theme-accent-text">
                          {scheduleQueryNum ? `Train #${scheduleQueryNum}` : activeTelemetry?.number || "Select Train"}
                        </span>
                      </h2>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Authentic CRIS Halt Timings, Distance (km), and Platform Assignments
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-2 rounded-xl theme-surface border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:opacity-80 transition text-xs flex items-center gap-1.5 min-h-[40px]"
                        title="Print Timetable"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("live")}
                        className="px-3 py-2 rounded-xl theme-accent-soft text-xs font-bold min-h-[40px]"
                      >
                        ← Back to Live Track
                      </button>
                    </div>
                  </div>

                  {/* Search Schedule Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (scheduleQueryNum) fetchTrainSchedule(scheduleQueryNum);
                    }}
                    className="flex flex-col sm:flex-row gap-2 max-w-md pt-1"
                  >
                    <input
                      type="text"
                      placeholder="Enter train number for timetable"
                      value={scheduleQueryNum}
                      onChange={(e) => setScheduleQueryNum(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl theme-input text-base sm:text-xs font-mono min-h-[44px] text-zinc-900 dark:text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-executive theme-accent-bg px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Load Route</span>
                    </button>
                  </form>

                  {/* Schedule Table */}
                  {scheduleData && scheduleData.stations.length > 0 ? (
                    <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pt-2 scrollbar-none">
                      <table className="w-full text-left border-collapse text-xs font-mono min-w-[500px]">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 uppercase text-[11px]">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Station Name</th>
                            <th className="py-2.5 px-3">Distance</th>
                            <th className="py-2.5 px-3">Arr</th>
                            <th className="py-2.5 px-3">Dep</th>
                            <th className="py-2.5 px-3">Platform</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                          {scheduleData.stations.map((st, idx) => (
                            <tr
                              key={`${st.station}-${idx}`}
                              onClick={() => setSelectedMapStation({ name: st.station, code: `STN-${idx + 1}` })}
                              className="hover:bg-zinc-100/70 dark:hover:bg-white/5 transition cursor-pointer text-zinc-800 dark:text-zinc-200"
                            >
                              <td className="py-3 px-3 font-bold theme-accent-text">{st.seq || idx + 1}</td>
                              <td className="py-3 px-3 font-sans font-semibold text-zinc-900 dark:text-white">{st.station}</td>
                              <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{st.distance} km</td>
                              <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">{st.arrival || "Origin"}</td>
                              <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">{st.departure || "Terminal"}</td>
                              <td className="py-3 px-3">
                                {st.platform ? (
                                  <span className="px-2 py-0.5 rounded theme-surface theme-accent-text border border-zinc-200 dark:border-white/10 font-bold">
                                    PF #{st.platform}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 dark:opacity-40">--</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-3">
                      <Clock className="w-8 h-8 text-zinc-400 dark:opacity-40 mx-auto" />
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">No Timetable Loaded Yet</div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                        Enter any 5-digit Indian Railways train number above and press Load Route to inspect official timetable stations.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TRAINS BETWEEN VIEW (Real search via /api/railway/trains/between) */}
              {activeTab === "between" && (
                <div className="p-4 sm:p-6 rounded-2xl theme-elevated space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white">Direct Corridor Search</h2>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Query direct trains between any two Indian Railways junction stations.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("live")}
                      className="self-start sm:self-auto px-3 py-2 rounded-xl theme-accent-soft text-xs font-bold min-h-[40px]"
                    >
                      ← Back to Live Track
                    </button>
                  </div>

                  {/* Form to query between stations */}
                  <form onSubmit={fetchTrainsBetween} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="Origin Code (e.g. NDLS)"
                      value={fromStation}
                      onChange={(e) => setFromStation(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 rounded-xl theme-input text-base sm:text-xs font-mono uppercase min-h-[48px] text-zinc-900 dark:text-white placeholder:text-zinc-500"
                    />
                    <input
                      type="text"
                      placeholder="Destination Code (e.g. CNB)"
                      value={toStation}
                      onChange={(e) => setToStation(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 rounded-xl theme-input text-base sm:text-xs font-mono uppercase min-h-[48px] text-zinc-900 dark:text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-executive theme-accent-bg px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 min-h-[48px]"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>Find Trains</span>
                    </button>
                  </form>

                  {/* Popular Route Shortcuts */}
                  <div className="flex items-center gap-2 pt-1 text-xs overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
                    <span className="text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold shrink-0">Popular:</span>
                    {[
                      { from: "NDLS", to: "CNB", label: "Delhi ➔ Kanpur" },
                      { from: "HWH", to: "NDLS", label: "Howrah ➔ Delhi" },
                      { from: "NZM", to: "VGLJ", label: "Nizamuddin ➔ Jhansi" },
                    ].map((rt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFromStation(rt.from);
                          setToStation(rt.to);
                        }}
                        className="px-2.5 py-1.5 rounded-lg theme-surface border border-zinc-200 dark:border-white/10 hover:bg-zinc-100/80 dark:hover:bg-white/10 font-mono text-[11px] shrink-0 min-h-[36px] text-zinc-800 dark:text-zinc-200"
                      >
                        {rt.label} ({rt.from}➔{rt.to})
                      </button>
                    ))}
                  </div>

                  {/* Results List */}
                  <div className="space-y-3 pt-2">
                    {trainsBetweenData && trainsBetweenData.length > 0 ? (
                      trainsBetweenData.map((tb, idx) => {
                        const tNum = tb.train?.number || tb.train_number || "";
                        const tName = tb.train?.name || tb.train_name || "Express";
                        const dep = tb.from?.departure || tb.departure_time || "--";
                        const arr = tb.to?.arrival || tb.arrival_time || "--";
                        const dur = tb.duration ? `${Math.floor(tb.duration / 60)}h ${tb.duration % 60}m` : tb.duration_str || "--";
                        const dist = tb.distance ? `${tb.distance} km` : "";

                        return (
                          <div
                            key={`${tNum}-${idx}`}
                            onClick={() => {
                              if (tNum) {
                                setSearchTrainNumber(tNum);
                                trackTrainLive(tNum);
                                setActiveTab("live");
                              }
                            }}
                            onMouseMove={updateSpotlight}
                            className="spotlight-card cursor-pointer p-4 rounded-xl theme-surface border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition hover:border-amber-500/40 text-zinc-800 dark:text-zinc-200"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-md theme-accent-bg font-mono font-bold text-xs shrink-0">
                                  {tNum}
                                </span>
                                <span className="font-bold text-sm text-zinc-900 dark:text-white">{tName}</span>
                              </div>
                              <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono mt-1.5 flex items-center gap-2 flex-wrap">
                                <span>Dep: {dep}</span>
                                <span>➔</span>
                                <span>Arr: {arr}</span>
                                {dur !== "--" && <span>• Duration: {dur}</span>}
                                {dist && <span>• {dist}</span>}
                              </div>
                            </div>
                            <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full theme-accent-soft font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 min-h-[38px]">
                              <span>Track Live</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center space-y-3">
                        <Navigation className="w-8 h-8 text-zinc-400 dark:opacity-40 mx-auto" />
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">Search Corridor Trains</div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                          Specify station codes above to discover all running direct express services on the corridor.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ===============================================================
                 RIGHT COLUMN (4 COLS):
                 RECENT LOOKUPS (Spotlight Cards loaded from localStorage, NO MOCK DATA)
                 & TELEMETRY BOX
                 =============================================================== */}
            <div className="lg:col-span-4 lg:border-l border-zinc-200 dark:border-white/10 lg:pl-8 flex flex-col justify-between space-y-4 sm:space-y-5">
              <div>
                {/* Header with Clear History button */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-3.5 h-3.5 theme-accent-text" />
                    <span>Recent Lookups</span>
                  </div>

                  {recentLookups.length > 0 && (
                    <button
                      onClick={clearRecentLookups}
                      className="px-2 py-1 rounded text-[11px] font-mono text-zinc-500 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 flex items-center gap-1 transition min-h-[32px]"
                      title="Clear Recent History"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {/* Recent Lookups Dynamic Render */}
                {recentLookups.length > 0 ? (
                  <div className="space-y-2.5 sm:space-y-3">
                    {recentLookups.map((item) => {
                      const isSelected = item.number === activeTelemetry?.number;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.type === "Schedule") {
                              setActiveTab("schedule");
                              fetchTrainSchedule(item.number);
                            } else if (item.type === "Between") {
                              setActiveTab("between");
                            } else {
                              setActiveTab("live");
                              setSearchTrainNumber(item.number);
                              trackTrainLive(item.number);
                            }
                          }}
                          onMouseMove={updateSpotlight}
                          className={`spotlight-card cursor-pointer p-3 sm:p-3.5 rounded-2xl theme-elevated border border-zinc-200 dark:border-white/10 active:scale-[0.99] transition ${
                            isSelected ? "border-amber-500/50" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1 relative z-10">
                            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                              {item.type}: {item.number}
                            </span>
                            <span className="px-2 py-0.5 rounded-md theme-accent-soft font-mono text-[10px] font-bold">
                              {item.badge}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-2 relative z-10">
                            <span>{item.dateLabel}</span>
                            <span className="font-mono font-semibold truncate max-w-[160px] text-zinc-700 dark:text-zinc-300">{item.routeShort || item.name || ""}</span>
                          </div>

                          <div className="w-full h-1 rounded-full bg-zinc-200 dark:bg-black/40 overflow-hidden relative z-10">
                            <div
                              className="h-full rounded-full theme-accent-bg transition-all duration-500"
                              style={{ width: `${item.progress || 60}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 sm:p-6 rounded-2xl theme-elevated text-center space-y-2 border border-zinc-200 dark:border-white/10">
                    <Clock className="w-6 h-6 text-zinc-400 dark:opacity-40 mx-auto" />
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">No Recent Lookups</div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Search for any train number or route above. Your lookups will be stored locally for fast one-tap recall.
                    </p>
                  </div>
                )}
              </div>

              {/* Traction & Corridor Telemetry Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl theme-elevated border border-zinc-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">3D Motion Telemetry</span>
                  <span className="font-mono theme-accent-text font-semibold">● KAVACH v4.0 ACTIVE</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl theme-surface border border-zinc-200 dark:border-white/10">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Catenary Line</div>
                    <div className="font-bold mt-0.5 text-zinc-900 dark:text-white">25.4 kV AC</div>
                  </div>
                  <div className="p-2.5 rounded-xl theme-surface border border-zinc-200 dark:border-white/10">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Braking State</div>
                    <div className="font-bold theme-accent-text mt-0.5 truncate">
                      {isBraking ? "FRICTION GLOW" : "NOMINAL CRUISE"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* =====================================================================
           4. STATION MAP & AMENITIES MODAL
           ===================================================================== */}
      <AnimatePresence>
        {selectedMapStation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMapStation(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl theme-surface rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[92vh] z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-black/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl theme-accent-soft flex items-center justify-center shrink-0">
                    <Map className="w-5 h-5 theme-accent-text" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold leading-tight truncate text-zinc-900 dark:text-white">{selectedMapStation.name}</h2>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 font-medium">
                      <span className="theme-accent-soft px-1.5 py-0.5 rounded font-mono text-[10px] sm:text-xs">
                        {selectedMapStation.code}
                      </span>
                      <span className="truncate">Station Concourse & Amenities</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMapStation(null)}
                  className="p-2.5 rounded-lg hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                <div className="theme-elevated rounded-xl border border-zinc-200 dark:border-white/10 p-1">
                  {/* Schematic Map */}
                  <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-black/60 rounded-lg overflow-hidden flex items-center justify-center border border-white/10">
                    <div className="absolute inset-0 flex flex-col justify-evenly py-4 sm:py-6 opacity-40">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-full h-2 bg-zinc-700 relative">
                          <div className="absolute left-3 sm:left-4 -top-3.5 sm:-top-4 text-[9px] sm:text-[10px] font-bold font-mono text-zinc-400">
                            PF {i}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-20 sm:w-24 h-3/4 bg-zinc-800 border-2 border-zinc-600 rounded-md shadow-sm flex items-center justify-center z-10">
                      <span className="text-[10px] sm:text-xs font-bold text-zinc-400 rotate-90 tracking-widest uppercase">
                        Terminal
                      </span>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-3 bottom-3 sm:top-4 sm:bottom-4 w-6 bg-amber-950/40 border-x border-amber-500/40 z-10 flex flex-col justify-between py-2">
                      <span className="text-[7px] sm:text-[8px] text-center font-bold theme-accent-text">BRIDGE</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-3 text-zinc-800 dark:text-zinc-200">Concourse Amenities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {[
                      { icon: Coffee, label: "IRCTC Cafeteria", desc: "Platform 1 & Food Plaza" },
                      { icon: Info, label: "Enquiry & Helpdesk", desc: "Main Concourse" },
                      { icon: ShieldCheck, label: "RPF Security Post", desc: "Platform 2" },
                      { icon: Map, label: "Prepaid Taxi Stand", desc: "Exit Gate A" },
                    ].map((amenity, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl theme-elevated border border-zinc-200 dark:border-white/10 min-h-[48px]"
                      >
                        <div className="w-8 h-8 rounded-full theme-accent-soft flex items-center justify-center shrink-0">
                          <amenity.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">{amenity.label}</div>
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{amenity.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
           5. EXECUTIVE FOOTER
           ===================================================================== */}
      <footer className="bg-[#060608] py-6 border-t border-white/10 mt-auto print:hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium opacity-65">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full theme-accent-bg animate-pulse"></div>
              CRIS Live Proxy Operational
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              60FPS Hardware-Accelerated Canvas Engine
            </div>
          </div>
          <div>© {new Date().getFullYear()} RailTrack Portal Executive. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
