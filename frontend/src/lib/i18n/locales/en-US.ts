import type { TranslationDictionary } from '../types'

export const enUS = {
	common: {
		save: 'Save',
		cancel: 'Cancel'
	},
	jobs: {
		count: '{count} jobs'
	}
} as const satisfies TranslationDictionary

export type AppDictionary = typeof enUS
