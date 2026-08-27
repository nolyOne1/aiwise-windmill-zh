import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadI18n() {
	vi.resetModules()
	return import('./index')
}

beforeEach(() => {
	localStorage.clear()
})

describe('production shell translations', () => {
	it('renders the remaining home, sidebar, and AI shell labels in Chinese', async () => {
		const { t } = await loadI18n()

		expect([
			t('app.favorites'),
			t('app.favoriteEmpty'),
			t('app.triggers'),
			t('app.schedules'),
			t('home.searchPlaceholder'),
			t('home.onlyFolders'),
			t('home.onlyUserAndFolders', { user: '1439123847' }),
			t('ai.chat'),
			t('ai.history'),
			t('ai.noHistory'),
			t('ai.newChat'),
			t('ai.navigatorPlaceholder'),
			t('ai.sessionsBeta'),
			t('ai.activate')
		]).toEqual([
			'收藏',
			'请先收藏项目',
			'触发器',
			'定时任务',
			'搜索脚本、流程和应用',
			'仅 f/*',
			'仅 u/1439123847 和 f/*',
			'聊天',
			'历史记录',
			'暂无历史记录',
			'新建聊天',
			'导航 Windmill 界面...',
			'试用 AI 会话（测试版）',
			'启用'
		])
	})

	it('keeps the same shell labels available in English', async () => {
		const { setLocale, t } = await loadI18n()
		setLocale('en-US')

		expect(t('app.favorites')).toBe('Favorites')
		expect(t('app.schedules')).toBe('Schedules')
		expect(t('ai.newChat')).toBe('New chat')
		expect(t('home.onlyUserAndFolders', { user: 'demo' })).toBe('Only u/demo and f/*')
	})
})
