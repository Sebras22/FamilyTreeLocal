export interface Storage {
  load(): Promise<string | null>
  save(data: string): Promise<void>
  backup?(data: string): Promise<void>
}
