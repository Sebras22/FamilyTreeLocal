import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSyncExternalStore } from 'react'
import { markDirty, onStateChange, replaceState, state } from '@/shared/api/demo/store'
import { ArboraError, mergeLibrary, parseLibrary, serializeLibrary } from './arbora'
import { getStorage, isTauri } from './storage'
import type { SaveStatus } from '@/interfaces/persistence/SaveStatus'
import type { StartResult } from '@/interfaces/persistence/StartResult'

const SAVE_DELAY_MS = 500

let status: SaveStatus = 'saved'
const listeners = new Set<() => void>()
const setStatus = (next: SaveStatus) => {
  if (status === next) return
  status = next
  for (const l of listeners) l()
}

export const useSaveStatus = (): SaveStatus =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )

let enabled = false
let dirty = false
let timer: ReturnType<typeof setTimeout> | null = null
let running: Promise<void> | null = null

async function drain() {
  try {
    while (dirty) {
      dirty = false
      const data = serializeLibrary(state)
      await getStorage().save(data)
    }
    setStatus('saved')
  } catch (e) {
    console.error('Enregistrement impossible', e)
    dirty = true
    setStatus('error')
  }
}

function runSave(): Promise<void> {
  running ??= drain().finally(() => {
    running = null
  })
  return running
}

async function flushSave(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  if (enabled && dirty) await runSave()
  else await running
}

onStateChange(() => {
  if (!enabled) return
  dirty = true
  setStatus('saving')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void runSave()
  }, SAVE_DELAY_MS)
})

if (typeof window !== 'undefined') {
  const flush = () => void flushSave()
  window.addEventListener('beforeunload', flush)
  window.addEventListener('pagehide', flush)
}

let closeGuarded = false
let forceClose = false

async function guardWindowClose() {
  if (closeGuarded || !isTauri()) return
  closeGuarded = true
  const window = getCurrentWindow()
  await window.onCloseRequested(async (event) => {
    if (forceClose || (!dirty && !timer && !running)) return
    event.preventDefault()
    await flushSave()
    if (status === 'error') {
      forceClose = true
      return
    }
    await window.destroy()
  })
}

export async function startLibrary(): Promise<StartResult> {
  let raw: string | null
  try {
    raw = await getStorage().load()
  } catch (e) {
    console.error('Lecture impossible', e)
    return { ok: false, message: "Impossible de lire le fichier de la bibliothèque. Il n'a pas été modifié.", raw: null }
  }
  if (raw !== null) {
    try {
      replaceState(parseLibrary(raw))
    } catch (e) {
      return { ok: false, message: e instanceof ArboraError ? e.message : 'Le fichier de la bibliothèque est illisible.', raw }
    }
  }
  enabled = true
  void guardWindowClose().catch((e) => console.error('Protection de la fermeture indisponible', e))
  return { ok: true }
}

export async function startEmpty(raw: string | null): Promise<void> {
  if (raw) {
    try {
      await getStorage().backup?.(raw)
    } catch (e) {
      console.error('Copie de sauvegarde impossible', e)
    }
  }
  enabled = true
  void guardWindowClose().catch((e) => console.error('Protection de la fermeture indisponible', e))
  markDirty()
}

export function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportLibrary(): Promise<void> {
  const text = serializeLibrary(state)
  downloadText(text, `arbora-${new Date().toISOString().slice(0, 10)}.arbora`, 'application/json')
}

export async function importLibraryFile(file: File): Promise<number> {
  const incoming = parseLibrary(await file.text())
  const added = mergeLibrary(state, incoming)
  markDirty()
  return added
}
