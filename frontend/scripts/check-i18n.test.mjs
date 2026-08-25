import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

async function createLocaleFixture(files) {
	const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'windmill-i18n-fixture-'))

	for (const [name, source] of Object.entries(files)) {
		await writeFile(path.join(fixtureDir, name), source, 'utf8')
	}

	return fixtureDir
}

test('validateLocalePair accepts matching dictionaries with aligned placeholders', async () => {
	const fixtureDir = await createLocaleFixture({
		'en-US.mjs': `export default {
  common: { save: 'Save' },
  jobs: { count: '{count} jobs' }
}`,
		'zh-CN.mjs': `export default {
  common: { save: '保存' },
  jobs: { count: '{count} 个作业' }
}`
	})

	try {
		const { loadLocaleFile, validateLocalePair } = await import('./check-i18n.mjs')
		const english = await loadLocaleFile(path.join(fixtureDir, 'en-US.mjs'))
		const chinese = await loadLocaleFile(path.join(fixtureDir, 'zh-CN.mjs'))

		assert.doesNotThrow(() => validateLocalePair(english, chinese))
	} finally {
		await rm(fixtureDir, { recursive: true, force: true })
	}
})

test('validateLocalePair reports the exact missing key', async () => {
	const fixtureDir = await createLocaleFixture({
		'en-US.mjs': `export default {
  account: { logout: 'Log out' },
  common: { save: 'Save' }
}`,
		'zh-CN.mjs': `export default {
  common: { save: '保存' }
}`
	})

	try {
		const { loadLocaleFile, validateLocalePair } = await import('./check-i18n.mjs')
		const english = await loadLocaleFile(path.join(fixtureDir, 'en-US.mjs'))
		const chinese = await loadLocaleFile(path.join(fixtureDir, 'zh-CN.mjs'))

		assert.throws(
			() => validateLocalePair(english, chinese),
			(error) =>
				error instanceof Error &&
				error.message.includes('account.logout') &&
				error.message.includes('Missing key')
		)
	} finally {
		await rm(fixtureDir, { recursive: true, force: true })
	}
})

test('validateLocalePair rejects placeholder mismatches with the offending key', async () => {
	const fixtureDir = await createLocaleFixture({
		'en-US.mjs': `export default {
  jobs: { count: '{count} jobs' }
}`,
		'zh-CN.mjs': `export default {
  jobs: { count: '{total} 个作业' }
}`
	})

	try {
		const { loadLocaleFile, validateLocalePair } = await import('./check-i18n.mjs')
		const english = await loadLocaleFile(path.join(fixtureDir, 'en-US.mjs'))
		const chinese = await loadLocaleFile(path.join(fixtureDir, 'zh-CN.mjs'))

		assert.throws(
			() => validateLocalePair(english, chinese),
			(error) =>
				error instanceof Error &&
				error.message.includes('jobs.count') &&
				error.message.includes('Placeholder mismatch')
		)
	} finally {
		await rm(fixtureDir, { recursive: true, force: true })
	}
})
