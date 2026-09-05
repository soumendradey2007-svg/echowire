import { useState, useEffect, useRef } from 'react';
import { onNetworkLoading } from '../lib/api';

export default function TopLoadingBar() {
  const [visible, setVisible] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressIntervalRef = useRef<any>(null);
  const slowTimerRef = useRef<any>(null);
  const resetTimerRef = useRef<any>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const clearTimers = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };

    const unsubscribe = onNetworkLoading((isLoading) => {
      if (isLoading) {
        // Cancel any pending reset/hide timer from previous completion
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
          resetTimerRef.current = null;
        }

        // Only initialize animation when starting from idle
        if (!isRunningRef.current) {
          isRunningRef.current = true;
          setVisible(true);
          setSlowLoading(false);
          setProgress(25);

          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          if (slowTimerRef.current) clearTimeout(slowTimerRef.current);

          progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev < 50) return prev + 8;
              if (prev < 75) return prev + 4;
              if (prev < 88) return prev + 1;
              return prev;
            });
          }, 250);

          // If operation takes longer than 4.5 seconds, show gentle reassurance notice
          slowTimerRef.current = setTimeout(() => {
            setSlowLoading(true);
          }, 4500);
        }
      } else {
        // All active network requests are now finished
        if (isRunningRef.current) {
          isRunningRef.current = false;

          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          if (slowTimerRef.current) {
            clearTimeout(slowTimerRef.current);
            slowTimerRef.current = null;
          }

          setSlowLoading(false);
          setProgress(100);

          resetTimerRef.current = setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 350);
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimers();
      isRunningRef.current = false;
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <>
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-transparent pointer-events-none overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent via-indigo-400 to-accent shadow-[0_0_8px_rgba(99,102,241,0.8)] transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 || !visible ? 0 : 1,
          }}
        />
      </div>

      {/* Gentle Reassurance Notice for longer network operations */}
      {slowLoading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs text-zinc-200 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
          <svg className="animate-spin h-3.5 w-3.5 text-accent flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="font-medium">Connecting to EchoWire server...</span>
        </div>
      )}
    </>
  );
}
