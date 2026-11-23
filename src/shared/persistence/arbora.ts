import type { CommentItem } from '@/interfaces/api/CommentItem'
import type { Couple } from '@/interfaces/api/Couple'
import type { DemoState } from '@/interfaces/demo/DemoState'
import type { HistoryItem } from '@/interfaces/api/HistoryItem'
import type { PersonRecord } from '@/interfaces/demo/PersonRecord'
import type { Relation } from '@/interfaces/api/Relation'
import type { ArboraFile } from '@/interfaces/persistence/ArboraFile'

const ARBORA_FORMAT = 'arbora'
const ARBORA_VERSION = 1

export class ArboraError extends Error {}

export function serializeLibrary(state: DemoState, savedAt = new Date().toISOString()): string {
  const snapshot = structuredClone(state)
  const file: ArboraFile = {
    format: ARBORA_FORMAT,
    version: ARBORA_VERSION,
    savedAt,
    trees: snapshot.trees,
    persons: snapshot.persons,
    parentLinks: snapshot.parentLinks,
    couples: snapshot.couples,
    relations: snapshot.relations,
    comments: snapshot.comments,
    history: snapshot.history,
    nextId: snapshot.nextId,
  }
  return JSON.stringify(file)
}

const invalid = (detail: string): never => {
  throw new ArboraError(`Fichier de bibliothèque invalide : ${detail}.`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0

function list(raw: Record<string, unknown>, key: string, idFields: string[]): Record<string, unknown>[] {
  const value = raw[key]
  if (!Array.isArray(value)) return invalid(`« ${key} » est manquant`)
  for (const item of value) {
    if (!isObject(item)) return invalid(`« ${key} » contient un élément incorrect`)
    for (const field of idFields) if (!isId(item[field])) return invalid(`« ${key} » contient un identifiant incorrect`)
  }
  return value as Record<string, unknown>[]
}

function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> {
  void version
  return raw
}

function withoutPhoto(person: Record<string, unknown>): PersonRecord {
  const record = { ...person }
  delete record.photo
  return record as unknown as PersonRecord
}

export function parseLibrary(text: string): DemoState {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ArboraError("Ce fichier n'est pas un fichier de bibliothèque Arbora (contenu illisible).")
  }
  if (!isObject(raw) || raw.format !== ARBORA_FORMAT) throw new ArboraError("Ce fichier n'est pas un fichier de bibliothèque Arbora.")
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return invalid('numéro de version incorrect')
  if (version > ARBORA_VERSION) {
    throw new ArboraError(`Ce fichier a été créé par une version plus récente d'Arbora (format ${version}). Mettez l'application à jour pour l'ouvrir.`)
  }
  const data = migrate(raw, version)

  const trees = list(data, 'trees', ['id'])
  const persons = list(data, 'persons', ['id', 'treeId'])
  const parentLinks = list(data, 'parentLinks', ['id', 'treeId', 'parentId', 'childId'])
  const couples = list(data, 'couples', ['id', 'treeId', 'person1Id', 'person2Id'])
  const relations = list(data, 'relations', ['id', 'treeId', 'personId', 'relatedId'])
  const comments = list(data, 'comments', ['id', 'personId'])
  const history = list(data, 'history', ['id', 'treeId'])

  const treeIds = new Set(trees.map((t) => t.id))
  const personIds = new Set(persons.map((p) => p.id))
  for (const t of trees) if (typeof t.name !== 'string') return invalid('un arbre n\'a pas de nom')
  for (const p of persons) {
    if (!treeIds.has(p.treeId)) return invalid('une personne appartient à un arbre inconnu')
    if (typeof p.firstName !== 'string' || typeof p.lastName !== 'string') return invalid('une personne n\'a pas de nom')
  }
  for (const l of parentLinks) if (!personIds.has(l.parentId) || !personIds.has(l.childId)) return invalid('un lien de parenté désigne une personne inconnue')
  for (const c of couples) if (!personIds.has(c.person1Id) || !personIds.has(c.person2Id)) return invalid('une union désigne une personne inconnue')
  for (const r of relations) if (!personIds.has(r.personId) || !personIds.has(r.relatedId)) return invalid('une relation désigne une personne inconnue')
  for (const c of comments) if (!personIds.has(c.personId)) return invalid('un commentaire désigne une personne inconnue')

  const maxId = Math.max(0, ...[trees, persons, parentLinks, couples, relations, comments, history].flatMap((rows) => rows.map((r) => r.id as number)))
  const declared = data.nextId
  if (!isId(declared)) return invalid('« nextId » est incorrect')

  return {
    trees: trees.map((t) => ({ id: t.id as number, name: t.name as string, selfPersonId: isId(t.selfPersonId) && personIds.has(t.selfPersonId) ? t.selfPersonId : null })),
    persons: persons.map(withoutPhoto),
    parentLinks: parentLinks as unknown as DemoState['parentLinks'],
    couples: couples as unknown as DemoState['couples'],
    relations: relations as unknown as DemoState['relations'],
    comments: comments as unknown as CommentItem[],
    history: history as unknown as DemoState['history'],
    nextId: Math.max(declared, maxId + 1),
  }
}

export function mergeLibrary(target: DemoState, incoming: DemoState): number {
  const fresh = () => target.nextId++
  const trees = new Map<number, number>()
  const persons = new Map<number, number>()
  for (const t of incoming.trees) trees.set(t.id, fresh())
  for (const p of incoming.persons) persons.set(p.id, fresh())
  const person = (id: number) => persons.get(id) as number

  for (const t of incoming.trees) {
    target.trees.push({ ...t, id: trees.get(t.id) as number, selfPersonId: t.selfPersonId == null ? null : (persons.get(t.selfPersonId) ?? null) })
  }
  for (const p of incoming.persons) target.persons.push({ ...p, id: person(p.id), treeId: trees.get(p.treeId) as number })
  for (const l of incoming.parentLinks) {
    const copy = { ...l, id: fresh(), treeId: trees.get(l.treeId) as number, parentId: person(l.parentId), childId: person(l.childId) }
    target.parentLinks.push(copy)
  }
  for (const c of incoming.couples) {
    const copy: Couple & { treeId: number } = { ...c, id: fresh(), treeId: trees.get(c.treeId) as number, person1Id: person(c.person1Id), person2Id: person(c.person2Id) }
    target.couples.push(copy)
  }
  for (const r of incoming.relations) {
    const copy: Relation & { treeId: number } = { ...r, id: fresh(), treeId: trees.get(r.treeId) as number, personId: person(r.personId), relatedId: person(r.relatedId) }
    target.relations.push(copy)
  }
  for (const c of incoming.comments) target.comments.push({ ...c, id: fresh(), personId: person(c.personId) })
  const history: (HistoryItem & { treeId: number })[] = incoming.history
    .filter((h) => trees.has(h.treeId))
    .map((h) => ({ ...h, id: fresh(), treeId: trees.get(h.treeId) as number, entityId: h.entityType === 'PERSON' && h.entityId != null ? (persons.get(h.entityId) ?? h.entityId) : h.entityId }))
  target.history.push(...history)
  return incoming.trees.length
}
