import { useEffect, useRef, useState } from 'react';

const API_BASE = '';

export function useLiveData() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/history`).then((r) => r.json()).then(setHistory).catch(() => {});
    fetch(`${API_BASE}/api/events`).then((r) => r.json()).then(setEvents).catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'reading') {
          setLatest(payload.data);
          setHistory((prev) => [...prev.slice(-29), payload.data]);
        }
        if (payload.type === 'event') {
          setEvents((prev) => [payload.data, ...prev].slice(0, 50));
        }
      } catch (e) {
        /* ignore malformed frame */
      }
    };

    return () => ws.close();
  }, []);

  const sendCommand = (command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command }));
    }
  };

  return { latest, history, events, connected, sendCommand };
}
