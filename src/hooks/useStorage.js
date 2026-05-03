import { useState, useEffect } from 'react'

export function useStorage() {
  const [storage, setStorage] = useState(null) // { freeGB, usedGB, totalGB }

  useEffect(() => {
    if (!navigator.storage?.estimate) return
    navigator.storage.estimate().then(({ usage, quota }) => {
      setStorage({
        freeGB: ((quota - usage) / 1e9).toFixed(1),
        usedGB: (usage / 1e9).toFixed(1),
        totalGB: (quota / 1e9).toFixed(1)
      })
    }).catch(() => {})
  }, [])

  return storage
}
