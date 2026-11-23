import type { CommentItem } from '@/interfaces/api/CommentItem'
import type { DemoState } from '@/interfaces/demo/DemoState'
import type { PersonRecord } from '@/interfaces/demo/PersonRecord'

export interface ArboraFile {
  format: 'arbora'
  version: number
  savedAt: string
  trees: DemoState['trees']
  persons: PersonRecord[]
  parentLinks: DemoState['parentLinks']
  couples: DemoState['couples']
  relations: DemoState['relations']
  comments: CommentItem[]
  history: DemoState['history']
  nextId: number
}
