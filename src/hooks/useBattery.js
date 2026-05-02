import { useState, useEffect } from 'react'

export function useBattery() {
  const [battery, setBattery] = useState(null)

  useEffect(() => {
    if (!('getBattery' in navigator)) return
    let b
    navigator.getBattery().then(bat => {
      b = bat
      const update = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging })
      update()
      bat.addEventListener('levelchange', update)
      bat.addEventListener('chargingchange', update)
    }).catch(() => {})
    return () => {
      if (b) {
        b.removeEventListener('levelchange', () => {})
        b.removeEventListener('chargingchange', () => {})
      }
    }
  }, [])

  return battery
}
