import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api, { tokenStore } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeCtx = createContext(null);
export const useRealtime = () => useContext(RealtimeCtx);

/**
 * One Socket.IO connection per logged-in user (Section 25).
 *  - 'notification'    -> bell list + toast
 *  - 'request:update'  -> fans out to pages through subscribe() so they can refetch instantly
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const socketRef = useRef(null);
  const listeners = useRef(new Set());
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 15 } });
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch { /* non critical */ }
  }, []);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setNotifications([]); setUnread(0); setConnected(false);
      return undefined;
    }
    loadNotifications();
    const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification', (n) => {
      setNotifications((xs) => [n, ...xs].slice(0, 30));
      setUnread((c) => c + 1);
      toast.info(`${n.title}: ${n.message}`);
    });
    const fan = (event) => (payload) => listeners.current.forEach((fn) => fn(event, payload));
    socket.on('request:update', fan('request:update'));
    socket.on('admin:event', fan('admin:event'));
    socket.on('technician:location', fan('technician:location'));
    return () => { socket.disconnect(); socketRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user && user._id]);

  const subscribe = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);
  const emit = useCallback((event, payload, ack) => { if (socketRef.current) socketRef.current.emit(event, payload, ack); }, []);

  const markRead = useCallback(async (id) => {
    setNotifications((xs) => xs.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    try { await api.put(`/notifications/${id}/read`); } catch { /* ignore */ }
  }, []);
  const markAllRead = useCallback(async () => {
    setNotifications((xs) => xs.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try { await api.put('/notifications/read-all'); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ connected, notifications, unread, subscribe, emit, markRead, markAllRead, reload: loadNotifications }), [connected, notifications, unread, subscribe, emit, markRead, markAllRead, loadNotifications]);
  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

/** Re-run `fn` whenever a live request update / admin event arrives (debounced). */
export function useLiveRefresh(fn, events = ['request:update', 'admin:event']) {
  const { subscribe } = useRealtime();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let t;
    const off = subscribe((event) => {
      if (!events.includes(event)) return;
      clearTimeout(t);
      t = setTimeout(() => fnRef.current(), 350);
    });
    return () => { off(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);
}
