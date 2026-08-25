/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { tick } from 'svelte'

async function loadComponent() {
	return import('./LanguageSelector.svelte')
}

async function loadI18n() {
	return import('$lib/i18n')
}

beforeEach(() => {
	localStorage.clear()
	document.body.innerHTML = ''
	vi.resetModules()
})

describe('LanguageSelector', () => {
	it('shows Chinese as the default active locale and offers English', async () => {
		const [{ default: LanguageSelector }, i18n] = await Promise.all([loadComponent(), loadI18n()])

		const component = mount(LanguageSelector, { target: document.body })
		await tick()
		flushSync()

		expect(i18n.locale.value).toBe('zh-CN')
		expect(document.body.textContent).toContain('简体中文')
		expect(document.body.textContent).toContain('English')

		unmount(component)
	})

	it('switches to en-US and persists the new locale when English is clicked', async () => {
		const [{ default: LanguageSelector }, i18n] = await Promise.all([loadComponent(), loadI18n()])

		const component = mount(LanguageSelector, { target: document.body })
		await tick()
		flushSync()

		const englishButton = Array.from(document.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('English')
		)

		englishButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		await tick()
		flushSync()

		expect(i18n.locale.value).toBe('en-US')
		expect(localStorage.getItem('windmill.locale')).toBe('en-US')

		unmount(component)
	})
})
