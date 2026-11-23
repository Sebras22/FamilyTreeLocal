import { invoke } from '@tauri-apps/api/core'
import type { Storage } from '@/interfaces/persistence/Storage'

const tauriStorage: Storage = {
  load: () => invoke<string | null>('read_library'),
  save: (data) => invoke<void>('write_library', { data }),
  backup: async (data) => {
    await invoke<string>('backup_library', { data })
  },
}

const DB_NAME = 'arbora'
const STORE = 'kv'
const KEY = 'library'
const KEY_BAK = 'library.bak'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponible'))
  })
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb()
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Écriture annulée'))
    })
  } finally {
    db.close()
  }
}

const hasIndexedDb = () => {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

const read = (key: string) => (hasIndexedDb() ? idbGet(key) : Promise.resolve(localStorage.getItem(key)))
const write = (key: string, value: string) =>
  hasIndexedDb()
    ? idbSet(key, value)
    : new Promise<void>((resolve, reject) => {
        try {
          localStorage.setItem(key, value)
          resolve()
        } catch (e) {
          reject(e)
        }
      })

const browserStorage: Storage = {
  load: () => read(KEY),
  save: (data) => write(KEY, data),
  backup: (data) => write(KEY_BAK, data),
}

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const getStorage = (): Storage => (isTauri() ? tauriStorage : browserStorage)
