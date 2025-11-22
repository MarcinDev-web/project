import React, { useEffect, useState } from 'react';

export interface DebugInfo {
  fps: number;
  ping: number;
  memory: number; // MB
  buildId: string | null;
  sessionId: string | null;
  renderer: string;
}

export function DebugOverlay(): React.JSX.Element {
  const [info, setInfo] = useState<DebugInfo>({
    fps: 0,
    ping: 0,
    memory: 0,
    buildId: null,
    sessionId: null,
    renderer: 'WebGPU',
  });

  useEffect(() => {
    // Mock stats update loop (in a real app this would come from the engine via props or store)
    const interval = setInterval(() => {
      const mem = (performance as any).memory;
      
      // Get buildId from URL if available
      const urlParams = new URLSearchParams(window.location.search);
      const buildId = urlParams.get('buildId') || 'dev-build';

      setInfo(prev => ({
        fps: Math.round(60 + Math.random() * 5 - 2.5), // Mock FPS around 60
        ping: Math.round(20 + Math.random() * 10), // Mock ping
        memory: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : 0,
        buildId,
        sessionId: prev.sessionId || `sess_${Math.random().toString(36).substr(2, 9)}`,
        renderer: 'WebGPU',
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <span style={styles.label}>FPS:</span>
        <span style={styles.value}>{info.fps}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Ping:</span>
        <span style={styles.value}>{info.ping} ms</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Memory:</span>
        <span style={styles.value}>{info.memory} MB</span>
      </div>
      <div style={styles.separator} />
      <div style={styles.row}>
        <span style={styles.label}>Build:</span>
        <span style={styles.value}>{info.buildId}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Session:</span>
        <span style={styles.value}>{info.sessionId}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Renderer:</span>
        <span style={styles.value}>{info.renderer}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '10px',
    right: '10px',
    padding: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '12px',
    pointerEvents: 'none',
    zIndex: 9999,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    minWidth: '150px',
    marginBottom: '2px',
  },
  label: {
    color: '#aaa',
    marginRight: '10px',
  },
  value: {
    fontWeight: 'bold',
  },
  separator: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    margin: '5px 0',
  },
};

