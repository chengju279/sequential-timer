import React, { useState, useEffect, WheelEvent, useRef } from 'react';
import { Play, Pause, RefreshCw, Volume2, Save, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';

interface TimerStep {
  id: number;
  name: string;
  duration: number;
}

interface Preset {
  id: number;
  name: string;
  steps: TimerStep[];
}

const STORAGE_KEY = 'timer-presets';

function loadPresetsFromStorage(): Preset[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function savePresetsToStorage(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function TimeUnit({ 
  value, 
  label, 
  onChange,
  max = 59,
  showLabel = true
}: { 
  value: number; 
  label: string;
  onChange: (delta: number) => void;
  max?: number;
  showLabel?: boolean;
}) {
  const prevValue = value === 0 ? max : value - 1;
  const nextValue = value === max ? 0 : value + 1;

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    onChange(delta);
  };

  return (
    <div className="flex flex-col items-center">
      {showLabel && <div className="text-2xl text-gray-400 mb-4">{label}</div>}
      <div 
        className="relative h-[180px] overflow-hidden bg-gray-800 rounded-lg w-[120px]"
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-gray-500 text-4xl mb-4">
            {String(prevValue).padStart(2, '0')}
          </div>
          <div className="text-blue-500 text-6xl font-bold mb-4 bg-gray-800/50 w-full text-center py-2">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-gray-500 text-4xl">
            {String(nextValue).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountdownDisplay({
  hours,
  minutes,
  seconds,
  isRunning,
  isPaused,
  onPause,
  onResume,
  onComplete,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}) {
  const prevTimeRef = useRef({ hours, minutes, seconds });

  useEffect(() => {
    if (isRunning && !isPaused) {
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      if (totalSeconds === 0 && prevTimeRef.current.hours === 0 && 
          prevTimeRef.current.minutes === 0 && prevTimeRef.current.seconds === 1) {
        onComplete();
      }
    }
    prevTimeRef.current = { hours, minutes, seconds };
  }, [hours, minutes, seconds, isRunning, isPaused, onComplete]);

  if (!isRunning && !isPaused) {
    return (
      <div className="text-8xl font-bold text-center text-gray-400">
        --<span className="mx-4">:</span>--<span className="mx-4">:</span>--
      </div>
    );
  }

  return (
    <div className={`text-8xl font-bold text-center ${isPaused ? 'text-gray-400' : 'text-blue-500'}`}>
      {String(hours).padStart(2, '0')}
      <span className="mx-4">:</span>
      {String(minutes).padStart(2, '0')}
      <span className="mx-4">:</span>
      {String(seconds).padStart(2, '0')}
    </div>
  );
}

function SavePresetModal({
  isOpen,
  onClose,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [presetName, setPresetName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">Save Preset</h2>
        <input
          type="text"
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (presetName.trim()) {
                onSave(presetName);
                setPresetName('');
              }
            }}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [timerName, setTimerName] = useState('');
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [displayHours, setDisplayHours] = useState(0);
  const [displayMinutes, setDisplayMinutes] = useState(0);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [steps, setSteps] = useState<TimerStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isMainTimerRunning, setIsMainTimerRunning] = useState(false);
  const [mainTimerRemainingTime, setMainTimerRemainingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [isUsingSteps, setIsUsingSteps] = useState(false);
  
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load presets from localStorage on initial render
  useEffect(() => {
    const loadedPresets = loadPresetsFromStorage();
    setPresets(loadedPresets);
  }, []);

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2434/2434-preview.mp3');
    audio.loop = true;
    alarmAudioRef.current = audio;

    return () => {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current = null;
      }
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (steps.length > 0) {
      const totalSeconds = steps.reduce((total, step) => total + step.duration, 0);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      if (isUsingSteps) {
        setDisplayHours(hours);
        setDisplayMinutes(minutes);
        setDisplaySeconds(seconds);
        setMainTimerRemainingTime(totalSeconds);
      }
    }
  }, [steps, isUsingSteps]);

  const resetSteps = () => {
    setCurrentStepIndex(0);
    if (steps.length > 0) {
      setRemainingTime(steps[0].duration);
      const totalSeconds = steps.reduce((total, step) => total + step.duration, 0);
      setMainTimerRemainingTime(totalSeconds);
      setDisplayHours(Math.floor(totalSeconds / 3600));
      setDisplayMinutes(Math.floor((totalSeconds % 3600) / 60));
      setDisplaySeconds(totalSeconds % 60);
    }
  };

  const playAlarm = () => {
    if (!alarmAudioRef.current) return;

    if (isAlarmPlaying) {
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current);
      }
      alarmAudioRef.current.currentTime = 0;
    }

    alarmAudioRef.current.play()
      .catch(error => console.error('Error playing alarm:', error));
    setIsAlarmPlaying(true);
    
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
    }
    alarmTimeoutRef.current = setTimeout(() => {
      stopAlarm();
    }, 60000);
  };

  const stopAlarm = () => {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
    }
    setIsAlarmPlaying(false);
  };

  const handleTimeChange = (type: 'hours' | 'minutes' | 'seconds', delta: number) => {
    if (isMainTimerRunning) return;
    
    switch (type) {
      case 'hours':
        setInputHours(prev => {
          const newValue = prev + delta;
          if (newValue >= 24) return 0;
          if (newValue < 0) return 23;
          return newValue;
        });
        break;
      case 'minutes':
        setInputMinutes(prev => {
          const newValue = prev + delta;
          if (newValue >= 60) return 0;
          if (newValue < 0) return 59;
          return newValue;
        });
        break;
      case 'seconds':
        setInputSeconds(prev => {
          const newValue = prev + delta;
          if (newValue >= 60) return 0;
          if (newValue < 0) return 59;
          return newValue;
        });
        break;
    }

    if (!isUsingSteps) {
      const totalSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
      setMainTimerRemainingTime(totalSeconds);
      setDisplayHours(inputHours);
      setDisplayMinutes(inputMinutes);
      setDisplaySeconds(inputSeconds);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startMainTimer = () => {
    const totalInputSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
    
    if (steps.length > 0) {
      setIsUsingSteps(true);
      if (isPaused) {
        setIsPaused(false);
        setIsMainTimerRunning(true);
        setIsRunning(true);
      } else if (!isMainTimerRunning) {
        setIsMainTimerRunning(true);
        setIsRunning(true);
        setCurrentStepIndex(0);
        setRemainingTime(steps[0].duration);
        setIsPaused(false);
      }
    } else if (totalInputSeconds > 0) {
      setIsUsingSteps(false);
      if (!isMainTimerRunning) {
        setMainTimerRemainingTime(totalInputSeconds);
        setDisplayHours(inputHours);
        setDisplayMinutes(inputMinutes);
        setDisplaySeconds(inputSeconds);
        setIsMainTimerRunning(true);
        setIsPaused(false);
      }
    }
    stopAlarm();
  };

  const pauseMainTimer = () => {
    setIsPaused(true);
    setIsMainTimerRunning(false);
    setIsRunning(false);
  };

  const resumeMainTimer = () => {
    setIsPaused(false);
    setIsMainTimerRunning(true);
    setIsRunning(true);
  };

  const resetMainTimer = () => {
    setIsMainTimerRunning(false);
    setIsRunning(false);
    setCurrentStepIndex(0);
    if (isUsingSteps && steps.length > 0) {
      setRemainingTime(steps[0].duration);
      const totalSeconds = steps.reduce((total, step) => total + step.duration, 0);
      setMainTimerRemainingTime(totalSeconds);
    } else {
      const totalSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
      setMainTimerRemainingTime(totalSeconds);
      setDisplayHours(inputHours);
      setDisplayMinutes(inputMinutes);
      setDisplaySeconds(inputSeconds);
    }
    setIsPaused(false);
    stopAlarm();
  };

  const clearTimeInput = () => {
    setInputHours(0);
    setInputMinutes(0);
    setInputSeconds(0);
    if (!isUsingSteps) {
      setDisplayHours(0);
      setDisplayMinutes(0);
      setDisplaySeconds(0);
      setMainTimerRemainingTime(0);
    }
  };

  const clearAllSteps = () => {
    if (!isRunning) {
      setSteps([]);
      setIsUsingSteps(false);
      setCurrentStepIndex(0);
      setRemainingTime(0);
      const totalSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
      setMainTimerRemainingTime(totalSeconds);
      setDisplayHours(inputHours);
      setDisplayMinutes(inputMinutes);
      setDisplaySeconds(inputSeconds);
    }
  };

  const addStep = () => {
    const totalSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
    if (totalSeconds > 0) {
      const newStep: TimerStep = {
        id: Date.now(),
        name: timerName || `Step ${steps.length + 1}`,
        duration: totalSeconds,
      };
      setSteps([...steps, newStep]);
      setTimerName('');
      setIsUsingSteps(true);
    }
  };

  const deleteStep = (stepId: number) => {
    if (isRunning) return;
    const newSteps = steps.filter(step => step.id !== stepId);
    setSteps(newSteps);
    if (newSteps.length === 0) {
      setIsUsingSteps(false);
    }
  };

  const savePreset = (name: string) => {
    if (steps.length > 0) {
      const newPreset: Preset = {
        id: Date.now(),
        name,
        steps: [...steps],
      };
      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets); // Save to localStorage
      setIsModalOpen(false);
    }
  };

  const loadPreset = (preset: Preset) => {
    setSteps([...preset.steps]);
    setIsPresetsOpen(false);
    setIsUsingSteps(true);
  };

  const deletePreset = (presetId: number) => {
    const updatedPresets = presets.filter(preset => preset.id !== presetId);
    setPresets(updatedPresets);
    savePresetsToStorage(updatedPresets); // Save to localStorage
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isMainTimerRunning && !isPaused) {
      interval = setInterval(() => {
        if (isUsingSteps) {
          setMainTimerRemainingTime((prev) => {
            if (prev <= 1) {
              setIsMainTimerRunning(false);
              setIsRunning(false);
              playAlarm();
              resetSteps();
              return steps.reduce((total, step) => total + step.duration, 0);
            }
            return prev - 1;
          });

          setRemainingTime((prev) => {
            if (prev <= 1) {
              playAlarm();
              if (currentStepIndex < steps.length - 1) {
                setCurrentStepIndex((prevIndex) => prevIndex + 1);
                return steps[currentStepIndex + 1].duration;
              } else {
                setIsRunning(false);
                setCurrentStepIndex(0);
                resetSteps();
                return steps[0].duration;
              }
            }
            return prev - 1;
          });
        } else {
          setMainTimerRemainingTime((prev) => {
            if (prev <= 1) {
              setIsMainTimerRunning(false);
              playAlarm();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isMainTimerRunning, isPaused, currentStepIndex, steps, isUsingSteps]);

  useEffect(() => {
    if (mainTimerRemainingTime > 0) {
      const h = Math.floor(mainTimerRemainingTime / 3600);
      const m = Math.floor((mainTimerRemainingTime % 3600) / 60);
      const s = mainTimerRemainingTime % 60;
      
      setDisplayHours(h);
      setDisplayMinutes(m);
      setDisplaySeconds(s);
    }
  }, [mainTimerRemainingTime]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-12">
        <div className="bg-white/5 p-8 rounded-2xl space-y-8">
          <CountdownDisplay
            hours={displayHours}
            minutes={displayMinutes}
            seconds={displaySeconds}
            isRunning={isMainTimerRunning}
            isPaused={isPaused}
            onPause={pauseMainTimer}
            onResume={resumeMainTimer}
            onComplete={playAlarm}
          />

          <div className="flex justify-center gap-4">
            {!isPaused ? (
              <button
                onClick={isMainTimerRunning ? pauseMainTimer : startMainTimer}
                className={`px-8 py-3 rounded-xl flex items-center gap-2 text-lg font-semibold transition-colors ${
                  isMainTimerRunning 
                    ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                disabled={steps.length === 0 && !inputHours && !inputMinutes && !inputSeconds}
              >
                {isMainTimerRunning ? (
                  <>
                    <Pause size={24} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={24} /> Start
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={resumeMainTimer}
                className="px-8 py-3 rounded-xl flex items-center gap-2 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play size={24} /> Resume
              </button>
            )}
            <button
              onClick={resetMainTimer}
              className="px-8 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2 text-lg font-semibold"
            >
              <RefreshCw size={24} /> Reset
            </button>
            {isAlarmPlaying && (
              <button
                onClick={stopAlarm}
                className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Volume2 size={24} />
              </button>
            )}
            {steps.length > 0 && !isRunning && (
              <button
                onClick={clearAllSteps}
                className="px-8 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2 text-lg font-semibold"
              >
                <Trash2 size={24} /> Clear Steps
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg space-y-8">
          <div className="flex justify-center items-center gap-4">
            <TimeUnit 
              value={inputHours} 
              label="Hours" 
              onChange={(delta) => handleTimeChange('hours', delta)}
              max={23}
            />
            <div className="text-6xl font-bold mt-12">:</div>
            <TimeUnit 
              value={inputMinutes} 
              label="Minutes" 
              onChange={(delta) => handleTimeChange('minutes', delta)}
            />
            <div className="text-6xl font-bold mt-12">:</div>
            <TimeUnit 
              value={inputSeconds} 
              label="Seconds" 
              onChange={(delta) => handleTimeChange('seconds', delta)}
            />
          </div>

          <input
            type="text"
            placeholder="Timer name"
            className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
            value={timerName}
            onChange={(e) => setTimerName(e.target.value)}
          />
          
          <div className="flex gap-2">
            <button
              onClick={addStep}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded p-2 transition"
            >
              Add item
            </button>
            <button
              onClick={clearTimeInput}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded p-2 transition"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={steps.length === 0}
            >
              <Save size={20} /> Save as Preset
            </button>

            <div className="relative flex-1">
              <button
                onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                className="w-full p-3 bg-gray-800 rounded-lg flex items-center justify-between text-left hover:bg-gray-700 transition-colors"
              >
                <span className="text-lg font-bold">Saved Presets</span>
                {isPresetsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {isPresetsOpen && (
                <div className="absolute right-0 w-full mt-2 bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700">
                  <div className="p-4 space-y-2">
                    {presets.length === 0 ? (
                      <div className="text-center text-gray-400 py-4">
                        No presets saved yet
                      </div>
                    ) : (
                      presets.map(preset => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                        >
                          <span className="font-medium">{preset.name}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadPreset(preset)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => deletePreset(preset.id)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex justify-between items-center p-6 rounded ${
                index === currentStepIndex && isRunning
                  ? 'bg-blue-900/50 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse'
                  : 'bg-gray-800 border border-gray-700'
              }`}
            >
              <span className="text-lg font-medium">{`${index + 1}. ${step.name}`}</span>
              <div className="flex items-center gap-6">
                <span className={`text-3xl font-bold ${
                  index === currentStepIndex && isRunning ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {formatTime(index === currentStepIndex ? remainingTime : step.duration)}
                </span>
                {!isRunning && (
                  <button
                    onClick={() => deleteStep(step.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SavePresetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={savePreset}
      />
    </div>
  );
}

export default App;