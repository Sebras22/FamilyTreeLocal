import type { DemoState } from '@/interfaces/demo/DemoState'

const emptyState = (): DemoState => ({ trees: [], persons: [], parentLinks: [], couples: [], relations: [], comments: [], history: [], nextId: 1 })

export const state: DemoState = emptyState()

export const replaceState = (next: DemoState) => {
  Object.assign(state, next)
}

export const nextId = () => state.nextId++

const listeners = new Set<() => void>()

export const onStateChange = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const markDirty = () => {
  for (const listener of listeners) listener()
}
