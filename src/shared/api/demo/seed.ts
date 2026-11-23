import { importGedcom } from './gedcom'
import { markDirty, state } from './store'
import gedcom from './famille-delacroix.ged?raw'

export function loadExampleTree(): number {
  const { treeId } = importGedcom(state, new TextEncoder().encode(gedcom), 'Famille Delacroix (exemple)')
  const tree = state.trees.find((t) => t.id === treeId)
  const me = state.persons.find((p) => p.treeId === treeId && p.firstName === 'Hugo')
  if (tree) tree.selfPersonId = me?.id ?? null
  markDirty()
  return treeId
}
