import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadI18nModule() {
	try {
		return await import('./index')
	} catch {
		return undefined
	}
}

const defaultLocalStorage = globalThis.localStorage

beforeEach(() => {
	globalThis.localStorage = defaultLocalStorage
	defaultLocalStorage.clear()
	vi.resetModules()
})

describe('i18n locale core', () => {
	it('defaults common.save to Chinese when no stored locale is present', async () => {
		const mod = await loadI18nModule()

		expect(mod?.t('common.save')).toBe('保存')
	})

	it('switches to en-US and persists the selected locale', async () => {
		const mod = await loadI18nModule()

		mod?.setLocale('en-US')

		expect(mod?.locale.value).toBe('en-US')
		expect(mod?.t('common.save')).toBe('Save')
		expect(localStorage.length).toBe(1)
	})

	it('interpolates named variables in Chinese translations', async () => {
		const mod = await loadI18nModule()

		expect(mod?.t('jobs.count', { count: 2 })).toBe('2 个作业')
	})

	it('falls back to English before returning the key itself', async () => {
		const mod = await loadI18nModule()

		expect(mod?.t('common.cancel')).toBe('Cancel')
		expect(mod?.t('missing.key')).toBe('missing.key')
	})

	it('defaults safely when storage is unavailable', async () => {
		globalThis.localStorage = {
			getItem() {
				throw new Error('storage unavailable')
			},
			setItem() {
				throw new Error('storage unavailable')
			},
			removeItem() {
				throw new Error('storage unavailable')
			},
			clear() {
				throw new Error('storage unavailable')
			},
			get length() {
				return 0
			},
			key() {
				return null
			}
		} as Storage

		const mod = await loadI18nModule()

		expect(mod?.t('common.save')).toBe('保存')
		expect(() => mod?.setLocale('en-US')).not.toThrow()
	})

	it('reuses a stored valid en-US selection on the next import', async () => {
		const first = await loadI18nModule()

		first?.setLocale('en-US')
		vi.resetModules()

		const second = await loadI18nModule()

		expect(second?.locale.value).toBe('en-US')
		expect(second?.t('common.save')).toBe('Save')
	})

	it('defaults to Chinese when the stored locale is invalid', async () => {
		const first = await loadI18nModule()

		first?.setLocale('en-US')
		const storageKey = localStorage.key(0)
		localStorage.clear()
		if (storageKey) {
			localStorage.setItem(storageKey, 'fr-FR')
		}
		vi.resetModules()

		const second = await loadI18nModule()

		expect(second?.locale.value).toBe('zh-CN')
		expect(second?.t('common.save')).toBe('保存')
	})
})
