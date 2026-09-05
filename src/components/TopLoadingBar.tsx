import { useState, useEffect } from 'react';
import { onNetworkLoading } from '../lib/api';

export default function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let slowTimer: any = null;
    let progressInterval: any = null;

    const unsubscribe = onNetworkLoading((isLoading) => {
      setLoading(isLoading);
      if (isLoading) {
        setProgress(25);
        // Gradually advance progress while waiting
        progressInterval = setInterval(() => {
          setProgress((prev) => (prev < 85 ? prev + Math.random() * 15 : prev));
        }, 300);

        // If request takes longer than 3 seconds, show gentle wake-up notice
        slowTimer = setTimeout(() => {
          setSlowLoading(true);
        }, 3000);
      } else {
        clearInterval(progressInterval);
        clearTimeout(slowTimer);
        setSlowLoading(false);
        setProgress(100);
        setTimeout(() => {
          setProgress(0);
        }, 300);
      }
    });

    return () => {
      unsubscribe();
      clearInterval(progressInterval);
      clearTimeout(slowTimer);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <>
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-transparent pointer-events-none overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent via-indigo-400 to-accent shadow-[0_0_8px_rgba(99,102,241,0.8)] transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
          }}
        />
      </div>

      {/* Gentle Reassurance Notice for longer network operations */}
      {slowLoading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs text-zinc-200 animate-in fade-in slide-in-from-top-2 duration-300">
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
