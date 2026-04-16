import React, { useState, useEffect } from 'react';

const DebugConsole = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      setLogs(prev => [...prev, args.join(' ')]);
      originalError(...args);
    };
    return () => { console.error = originalError; };
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full max-h-40 bg-black/80 text-white text-[10px] p-2 overflow-y-auto z-[9999]">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold">Console Erros:</span>
        <button onClick={() => setLogs([])} className="bg-white/20 px-1 rounded">Limpar</button>
      </div>
      {logs.map((log, i) => <div key={i} className="border-b border-white/10 p-0.5">{log}</div>)}
    </div>
  );
};

export default DebugConsole;
