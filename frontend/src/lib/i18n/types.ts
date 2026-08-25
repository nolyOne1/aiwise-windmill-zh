export type TranslationLeaf = string

export type TranslationDictionary = {
	[key: string]: TranslationLeaf | TranslationDictionary
}

export type PartialLocaleDictionary<T extends TranslationDictionary> = {
	[K in keyof T]?: T[K] extends string ? string : PartialLocaleDictionary<Extract<T[K], TranslationDictionary>>
}

export type DotKey<T extends TranslationDictionary> = {
	[K in keyof T & string]: T[K] extends string ? K : `${K}.${DotKey<Extract<T[K], TranslationDictionary>>}`
}[keyof T & string]

export type InterpolationValues = Record<string, string | number | boolean | null | undefined>
