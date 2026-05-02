const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let accessToken = null
let tokenClient = null

export function initGoogleAuth(onAuthed) {
  if (!window.google) return
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.error) return
      accessToken = response.access_token
      onAuthed()
    }
  })
}

export function requestDriveAuth() {
  tokenClient?.requestAccessToken()
}

export function isDriveAuthed() {
  return !!accessToken
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
