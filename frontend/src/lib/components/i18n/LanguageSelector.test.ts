import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const componentUrl = new URL('./LanguageSelector.svelte', import.meta.url)

beforeEach(() => {
	localStorage.clear()
	vi.resetModules()
})

describe('LanguageSelector', () => {
	it('declares Chinese and English choices and wires selection to the locale setter', async () => {
		const source = await readFile(componentUrl, 'utf8')

		expect(source).toContain("value=\"zh-CN\"")
		expect(source).toContain("value=\"en-US\"")
		expect(source).toContain("label={LOCALE_LABELS['zh-CN']}")
		expect(source).toContain("label={LOCALE_LABELS['en-US']}")
		expect(source).toContain('onSelected={handleSelect}')
		expect(source).toContain('setLocale(next as Locale)')
	})

	it('uses Chinese by default and persists an English selection', async () => {
		const i18n = await import('$lib/i18n')

		expect(i18n.locale.value).toBe('zh-CN')
		i18n.setLocale('en-US')
		expect(i18n.locale.value).toBe('en-US')
		expect(localStorage.getItem('windmill.locale')).toBe('en-US')
	})
})
