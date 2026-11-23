import { describe, expect, it } from 'vitest'
import sample from '@/shared/api/demo/famille-delacroix.ged?raw'
import { importGedcom } from '@/shared/api/demo/gedcom'
import type { DemoState } from '@/interfaces/demo/DemoState'
import { ArboraError, mergeLibrary, parseLibrary, serializeLibrary } from './arbora'

const emptyState = (): DemoState => ({ trees: [], persons: [], parentLinks: [], couples: [], relations: [], comments: [], history: [], nextId: 1 })

function exampleState(): DemoState {
  const state = emptyState()
  importGedcom(state, new TextEncoder().encode(sample), 'Exemple')
  return state
}

const withMutation = (mutate: (file: Record<string, unknown>) => void) => {
  const file = JSON.parse(serializeLibrary(exampleState())) as Record<string, unknown>
  mutate(file)
  return JSON.stringify(file)
}

describe('serializeLibrary et parseLibrary', () => {
  it('conserve toutes les données lors d’un aller-retour', () => {
    const original = exampleState()
    const restored = parseLibrary(serializeLibrary(original, '2026-01-01T00:00:00.000Z'))
    expect(restored.trees).toEqual(original.trees)
    expect(restored.parentLinks).toEqual(original.parentLinks)
    expect(restored.couples).toEqual(original.couples)
    expect(restored.persons.map((p) => p.firstName)).toEqual(original.persons.map((p) => p.firstName))
    expect(restored.nextId).toBe(original.nextId)
  })

  it('écrit le format, la version et la date', () => {
    const file = JSON.parse(serializeLibrary(exampleState(), '2026-01-01T00:00:00.000Z'))
    expect(file).toMatchObject({ format: 'arbora', version: 1, savedAt: '2026-01-01T00:00:00.000Z' })
  })

  it('ignore les photos des anciens fichiers', () => {
    const text = withMutation((f) => {
      ;(f.persons as { photo?: string }[])[0].photo = 'data:image/png;base64,AQID'
    })
    const restored = parseLibrary(text)
    expect('photo' in restored.persons[0]).toBe(false)
    expect(JSON.parse(serializeLibrary(restored)).persons[0].photo).toBeUndefined()
  })

  it('ne modifie pas l’état d’origine', () => {
    const state = exampleState()
    const before = JSON.stringify(state.persons.map((p) => p.firstName))
    serializeLibrary(state)
    expect(JSON.stringify(state.persons.map((p) => p.firstName))).toBe(before)
  })
})

describe('parseLibrary : rejets', () => {
  it('rejette un texte qui n’est pas du JSON', () => {
    expect(() => parseLibrary('pas du json')).toThrow(ArboraError)
  })

  it('rejette un JSON qui n’est pas une bibliothèque Arbora', () => {
    expect(() => parseLibrary('{"format":"autre"}')).toThrow(/pas un fichier de bibliothèque/)
    expect(() => parseLibrary('[]')).toThrow(ArboraError)
  })

  it('rejette une version plus récente que celle de l’application', () => {
    const text = withMutation((f) => {
      f.version = 99
    })
    expect(() => parseLibrary(text)).toThrow(/version plus récente/)
  })

  it('rejette un numéro de version incorrect', () => {
    const text = withMutation((f) => {
      f.version = 'x'
    })
    expect(() => parseLibrary(text)).toThrow(/numéro de version/)
  })

  it('rejette une liste manquante', () => {
    const text = withMutation((f) => {
      delete f.persons
    })
    expect(() => parseLibrary(text)).toThrow(/« persons » est manquant/)
  })

  it('rejette une personne rattachée à un arbre inconnu', () => {
    const text = withMutation((f) => {
      ;(f.persons as { treeId: number }[])[0].treeId = 99999
    })
    expect(() => parseLibrary(text)).toThrow(/arbre inconnu/)
  })

  it('rejette un lien de parenté vers une personne inconnue', () => {
    const text = withMutation((f) => {
      ;(f.parentLinks as { parentId: number }[])[0].parentId = 99999
    })
    expect(() => parseLibrary(text)).toThrow(/lien de parenté/)
  })
})

describe('parseLibrary : tolérance', () => {
  it('corrige un nextId trop petit', () => {
    const text = withMutation((f) => {
      f.nextId = 1
    })
    const restored = parseLibrary(text)
    const maxId = Math.max(...restored.persons.map((p) => p.id))
    expect(restored.nextId).toBeGreaterThan(maxId)
  })

  it('ignore une personne « moi » qui n’existe pas', () => {
    const text = withMutation((f) => {
      ;(f.trees as { selfPersonId: number | null }[])[0].selfPersonId = 99999
    })
    expect(parseLibrary(text).trees[0].selfPersonId).toBeNull()
  })
})

describe('mergeLibrary', () => {
  it('ajoute les arbres avec de nouveaux identifiants sans collision', () => {
    const target = exampleState()
    const incoming = exampleState()
    const personsBefore = target.persons.length
    const added = mergeLibrary(target, incoming)
    expect(added).toBe(1)
    expect(target.trees).toHaveLength(2)
    expect(target.persons).toHaveLength(personsBefore * 2)
    const ids = [...target.trees.map((t) => t.id), ...target.persons.map((p) => p.id), ...target.couples.map((c) => c.id), ...target.parentLinks.map((l) => l.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reconnecte les liens aux nouvelles personnes', () => {
    const target = exampleState()
    mergeLibrary(target, exampleState())
    const newTree = target.trees[1]
    const newPersonIds = new Set(target.persons.filter((p) => p.treeId === newTree.id).map((p) => p.id))
    for (const link of target.parentLinks.filter((l) => l.treeId === newTree.id)) {
      expect(newPersonIds.has(link.parentId)).toBe(true)
      expect(newPersonIds.has(link.childId)).toBe(true)
    }
  })

  it('laisse intact le contenu déjà présent', () => {
    const target = exampleState()
    const firstPersonBefore = JSON.stringify(target.persons[0])
    mergeLibrary(target, exampleState())
    expect(JSON.stringify(target.persons[0])).toBe(firstPersonBefore)
  })

  it('renvoie 0 pour une bibliothèque vide', () => {
    expect(mergeLibrary(exampleState(), emptyState())).toBe(0)
  })
})
