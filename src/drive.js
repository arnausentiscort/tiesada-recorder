const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

let accessToken = null
let tokenClient = null
let userInfo = null  // { email, name, picture }

export function initGoogleAuth(onAuthed, onError) {
  if (!window.google?.accounts) return
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    hint: localStorage.getItem('lastDriveEmail') || undefined,
    callback: async (response) => {
      if (response.error) {
        const isOrgRestricted = response.error === 'access_denied' || response.error === 'unauthorized_client'
        onError?.(isOrgRestricted
          ? 'Compte bloquejat. A Google Cloud Console → Pantalla de consentiment OAuth → canvia a "Extern"'
          : `Error d'autenticació: ${response.error}`
        )
        return
      }
      accessToken = response.access_token
      await fetchUserInfo()
      onAuthed(userInfo)
    }
  })
}

export function requestDriveAuth() {
  tokenClient?.requestAccessToken({ prompt: 'select_account' })
}

export function requestAccountChange() {
  tokenClient?.requestAccessToken({ prompt: 'select_account' })
}

export function isDriveAuthed() {
  return !!accessToken
}

export function getAccountInfo() {
  return userInfo
}

async function fetchUserInfo() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (res.ok) {
      userInfo = await res.json()
      localStorage.setItem('lastDriveEmail', userInfo.email)
    }
  } catch (_) {}
}

async function fetchDrive(path, options = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers }
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  return res.json()
}

async function getOrCreateFolder(name, parentId = null) {
  const parentQ = parentId ? `'${parentId}' in parents` : `'root' in parents`
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and ${parentQ} and trashed=false`
  const data = await fetchDrive(`files?q=${encodeURIComponent(q)}&fields=files(id)`)
  if (data.files?.length > 0) return data.files[0].id

  const body = { name, mimeType: 'application/vnd.google-apps.folder' }
  if (parentId) body.parents = [parentId]
  const folder = await fetchDrive('files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return folder.id
}

// Ensures tiesada_partits/models/ exists and checks for best.pt
export async function ensureModelsFolder() {
  if (!accessToken) return { hasBestPt: null, modelsId: null }
  try {
    const rootId = await getOrCreateFolder('tiesada_partits')
    const modelsId = await getOrCreateFolder('models', rootId)
    const q = `name='best.pt' and '${modelsId}' in parents and trashed=false`
    const data = await fetchDrive(`files?q=${encodeURIComponent(q)}&fields=files(id)`)
    return { modelsId, hasBestPt: (data.files?.length ?? 0) > 0 }
  } catch (_) {
    return { hasBestPt: null, modelsId: null }
  }
}

export async function uploadToDrive(blob, filename, matchName) {
  if (!accessToken) throw new Error('No autenticat a Drive')
  const rootId = await getOrCreateFolder('tiesada_partits')
  const matchId = await getOrCreateFolder(matchName, rootId)

  const metadata = { name: filename, parents: [matchId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  )
  if (!res.ok) throw new Error(`Upload fallat: ${res.status}`)
  return res.json()
}
