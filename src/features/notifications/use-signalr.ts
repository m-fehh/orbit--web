'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { tokenStore } from '@/shared/api/token-store';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://localhost:5001/hubs/orbit';

/**
 * Conexão SignalR ao OrbitHub (/hubs/orbit) com autenticação via accessTokenFactory.
 * Reconexão automática. `onEvent` registra um handler para um método do servidor
 * (ex.: "notification"). Usado pelo Notification Center .
 */
export function useSignalR(
  methodName: string,
  onEvent: (...args: unknown[]) => void,
  enabled: boolean,
) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => tokenStore.getAccessToken() ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const handler = (...args: unknown[]) => handlerRef.current(...args);
    connection.on(methodName, handler);
    connection.onreconnected(() => setConnected(true));
    connection.onreconnecting(() => setConnected(false));
    connection.onclose(() => setConnected(false));

    let cancelled = false;
    connection
      .start()
      .then(() => {
        if (!cancelled) setConnected(true);
      })
      .catch(() => setConnected(false));

    return () => {
      cancelled = true;
      connection.off(methodName, handler);
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [methodName, enabled]);

  return { connected };
}

/**
 * Conecta ao OrbitHub, entra em um grupo (ex.: sala de um ticket) e escuta os eventos
 * de grupo (`ReceiveEvent`). Chama `onEvent(eventName, payload)` a cada evento recebido.
 * Usado para a conversa do ticket "pingar" em tempo real (mensagens de WhatsApp, etc.).
 */
export function useSignalRGroup(
  group: string | null,
  onEvent: (eventName: string, payload: unknown) => void,
  enabled: boolean,
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !group) return;

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => tokenStore.getAccessToken() ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const handler = (eventName: string, payload: unknown) => handlerRef.current(eventName, payload);
    connection.on('ReceiveEvent', handler);

    const join = () => { void connection.invoke('JoinGroup', group).catch(() => {}); };
    connection.onreconnected(join); // re-entra no grupo após reconexão

    let cancelled = false;
    connection
      .start()
      .then(() => { if (!cancelled) join(); })
      .catch(() => {});

    return () => {
      cancelled = true;
      connection.off('ReceiveEvent', handler);
      if (connection.state === HubConnectionState.Connected) {
        void connection.invoke('LeaveGroup', group).catch(() => {});
      }
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [group, enabled]);
}
