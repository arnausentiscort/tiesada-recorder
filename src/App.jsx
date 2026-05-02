import { useState } from 'react'
import SetupView from './components/SetupView'
import RecorderView from './components/RecorderView'

export default function App() {
  const [session, setSession] = useState(null)

  return session ? (
    <RecorderView {...session} onDisconnect={() => setSession(null)} />
  ) : (
    <SetupView onConnect={setSession} />
  )
}
