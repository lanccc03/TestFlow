export type ItemList<T = unknown> = {
  items: T[]
}

export type JsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
