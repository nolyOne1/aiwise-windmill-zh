import { enUS, type AppDictionary } from './locales/en-US'
import { zhCN } from './locales/zh-CN'
import type { DotKey, InterpolationValues, TranslationDictionary } from './types'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]
type TranslationKey = DotKey<AppDictionary>
type LocaleCatalog = AppDictionary
type LocaleSubscriber = (value: Locale) => void

const DEFAULT_LOCALE: Locale = 'zh-CN'
const STORAGE_KEY = 'windmill.locale'
export const LOCALE_LABELS: Record<Locale, string> = {
	'zh-CN': '简体中文',
	'en-US': 'English'
}
const dictionaries: Record<Locale, LocaleCatalog> = {
	'zh-CN': zhCN,
	'en-US': enUS
}

function isLocale(value: string | null | undefined): value is Locale {
	return value === 'zh-CN' || value === 'en-US'
}

function getStorage(): Storage | undefined {
	try {
		return globalThis.localStorage
	} catch {
		return undefined
	}
}

function readStoredLocale(): Locale {
	const storage = getStorage()

	if (!storage) {
		return DEFAULT_LOCALE
	}

	try {
		const stored = storage.getItem(STORAGE_KEY)
		return isLocale(stored) ? stored : DEFAULT_LOCALE
	} catch {
		return DEFAULT_LOCALE
	}
}

function persistLocale(next: Locale): void {
	const storage = getStorage()

	if (!storage) {
		return
	}

	try {
		storage.setItem(STORAGE_KEY, next)
	} catch {
		// Some browsers expose localStorage but reject access. Keep runtime safe.
	}
}

function createLocaleStore(initial: Locale) {
	let current = initial
	const subscribers = new Set<LocaleSubscriber>()

	return {
		get value(): Locale {
			return current
		},
		subscribe(run: LocaleSubscriber) {
			run(current)
			subscribers.add(run)

			return () => {
				subscribers.delete(run)
			}
		},
		set(next: Locale) {
			current = next
			subscribers.forEach((subscriber) => subscriber(current))
		}
	}
}

function lookupTranslation(dictionary: LocaleCatalog, key: string): string | undefined {
	const segments = key.split('.')
	let cursor: string | TranslationDictionary | undefined = dictionary as TranslationDictionary

	for (const segment of segments) {
		if (!cursor || typeof cursor === 'string' || !(segment in cursor)) {
			return undefined
		}

		cursor = cursor[segment]
	}

	return typeof cursor === 'string' ? cursor : undefined
}

function interpolate(template: string, variables?: InterpolationValues): string {
	if (!variables) {
		return template
	}

	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = variables[name]
		return value === undefined || value === null ? match : String(value)
	})
}

const localeStore = createLocaleStore(readStoredLocale())

export const locale = localeStore

export function setLocale(next: Locale): void {
	localeStore.set(next)
	persistLocale(next)
}

export function t(key: TranslationKey | string, variables?: InterpolationValues): string {
	const currentDictionary = dictionaries[localeStore.value]
	const englishDictionary = dictionaries['en-US']
	const translation =
		lookupTranslation(currentDictionary, key) ?? lookupTranslation(englishDictionary, key) ?? key

	return interpolate(translation, variables)
}
