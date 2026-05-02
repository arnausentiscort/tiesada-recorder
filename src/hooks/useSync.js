import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

export function useSync({ roomCode, role, onCommand, onRemoteStatus, onPeerJoin }) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!roomCode) return

    const ch = supabase.channel(`recorder-${roomCode}`, {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: 'command' }, ({ payload }) => onCommand?.(payload))
      .on('broadcast', { event: 'status' }, ({ payload }) => onRemoteStatus?.(payload))
      .on('broadcast', { event: 'join' }, ({ payload }) => onPeerJoin?.(payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'join', payload: { role, ts: Date.now() } })
        }
      })

    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [roomCode, role])

  const sendCommand = useCallback((type) => {
    channelRef.current?.send({ type: 'broadcast', event: 'command', payload: { type } })
  }, [])

  const sendStatus = useCallback((payload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { ...payload, role } })
  }, [role])

  return { sendCommand, sendStatus }
}
