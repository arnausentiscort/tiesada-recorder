import { useState } from 'react'
import { Video, Wifi } from 'lucide-react'

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

export default function SetupView({ onConnect }) {
  const [matchName, setMatchName] = useState('')
  const [mode, setMode] = useState(null)
  const [roomCode, setRoomCode] = useState('')

  function selectMaster() {
    setMode('master')
    setRoomCode(generateCode())
  }

  function selectSlave() {
    setMode('slave')
    setRoomCode('')
  }

  function handleConnect() {
    const name = matchName.trim()
    const code = roomCode.trim().toUpperCase()
    if (!name || !code || code.length < 4) return
    onConnect({ matchName: name, role: mode, roomCode: code })
  }

  const canConnect = matchName.trim() && roomCode.trim().length >= 4

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#1E1E1E] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Video size={32} className="text-[#E5C07B]" />
        </div>
        <h1 className="text-2xl font-bold text-[#E5C07B]">Tiesada Recorder</h1>
        <p className="text-gray-500 text-sm mt-1">Gravació sincronitzada</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Nom del partit</label>
          <input
            value={matchName}
            onChange={e => setMatchName(e.target.value)}
            placeholder="ex: J9-Vikings"
            className="w-full bg-[#1E1E1E] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#E5C07B] transition-colors"
          />
        </div>

        {!mode && (
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Rol del dispositiu</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={selectMaster}
                className="bg-[#E5C07B] text-black font-bold py-4 rounded-xl text-base active:scale-95 transition-transform"
              >
                MASTER
              </button>
              <button
                onClick={selectSlave}
                className="bg-[#1E1E1E] border border-gray-600 text-white font-bold py-4 rounded-xl text-base active:scale-95 transition-transform"
              >
                SLAVE
              </button>
            </div>
          </div>
        )}

        {mode === 'master' && (
          <div className="bg-[#1E1E1E] rounded-xl p-5 text-center border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Codi de sala — envia al slave</p>
            <p className="text-5xl font-mono font-bold text-[#E5C07B] tracking-[0.3em]">{roomCode}</p>
            <button onClick={selectMaster} className="text-gray-600 text-xs mt-3">Regenerar codi</button>
          </div>
        )}

        {mode === 'slave' && (
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Codi de sala del master</label>
            <input
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="XXXX"
              maxLength={6}
              className="w-full bg-[#1E1E1E] border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-3xl font-mono tracking-[0.4em] placeholder-gray-600 focus:outline-none focus:border-[#E5C07B] transition-colors"
            />
          </div>
        )}

        {mode && (
          <button
            onClick={handleConnect}
            disabled={!canConnect}
            className="w-full bg-[#C0392B] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Wifi size={20} />
            Connecta
          </button>
        )}

        {mode && (
          <button onClick={() => setMode(null)} className="w-full text-gray-600 text-sm py-2">
            ← Canvia rol
          </button>
        )}
      </div>
    </div>
  )
}
