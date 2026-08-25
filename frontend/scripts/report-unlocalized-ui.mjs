import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(currentDir, '..')
const allowlistPath = path.join(frontendDir, 'i18n/unlocalized-allowlist.json')
const targetExtensions = new Set(['.svelte', '.ts', '.js'])
const defaultTargets = [
	'src/routes/(root)/(logged)/+layout.svelte',
	'src/routes/(root)/(logged)/user/(user)/login/+page.svelte',
	'src/routes/(root)/(logged)/user/(user)/workspaces/+page.svelte',
	'src/lib/components/Login.svelte',
	'src/lib/components/UserSettings.svelte',
	'src/lib/components/settings/UserInfoSettings.svelte',
	'src/lib/components/settings/AIUserSettings.svelte',
	'src/lib/components/sidebar/SettingsMenu.svelte',
	'src/lib/components/sidebar/WorkspaceMenu.svelte',
	'src/lib/components/workspace/WorkspaceTreeView.svelte'
]

function shouldInspectLiteral(literal) {
	const trimmed = literal.trim()
	if (trimmed.length === 0) return false
	if (!/[A-Za-z\u4e00-\u9fff]/.test(trimmed)) return false
	if (/^(ts|js|mjs|svelte|sm|md|lg|xs|xs2|xs3|default|accent|subtle|true|false|http|https)$/.test(trimmed)) {
		return false
	}
	if (/^[A-Za-z0-9_$./:@?&=#{}()[\]-]+$/.test(trimmed) && !/[A-Z\u4e00-\u9fff]/.test(trimmed)) {
		return false
	}
	if (/^(bg-|text-|px-|py-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|gap-|flex|grid|rounded|border|shadow|hover:|dark:|sm:|lg:|md:|w-|h-|min-|max-|items-|justify-|relative|absolute|fixed|hidden|block|inline|cursor-)/.test(trimmed)) {
		return false
	}
	return true
}

function matchesRule(relativePath, literal, rule) {
	return new RegExp(rule.path).test(relativePath) && new RegExp(rule.literal).test(literal)
}

function findAllowlistReason(relativePath, literal, rules) {
	const match = rules.find((rule) => matchesRule(relativePath, literal, rule))
	return match?.reason
}

function collectStringLiterals(line) {
	if (/^\s*import\s/.test(line) || /^\s*export\s/.test(line)) {
		return []
	}

	const results = []

	for (const match of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
		const literal = match[2]
		if (/^[a-z]+\.[a-zA-Z0-9_.-]+$/.test(literal)) {
			continue
		}
		results.push(literal)
	}

	for (const match of line.matchAll(/>([^<{][^<]*)</g)) {
		results.push(match[1])
	}

	return results.filter(shouldInspectLiteral)
}

async function expandTargets(targets) {
	const files = []

	async function visit(relativePath) {
		const absolutePath = path.join(frontendDir, relativePath)
		const statEntries = await readdir(absolutePath, { withFileTypes: true })

		for (const entry of statEntries) {
			const nextRelative = path.posix.join(relativePath.replace(/\\/g, '/'), entry.name)
			if (entry.isDirectory()) {
				await visit(nextRelative)
			} else if (targetExtensions.has(path.extname(entry.name))) {
				files.push(nextRelative.replace(/\\/g, '/'))
			}
		}
	}

	for (const target of targets) {
		const normalized = target.replace(/\\/g, '/')
		const absolute = path.join(frontendDir, normalized)
		try {
			const entries = await readdir(absolute, { withFileTypes: true })
			if (entries) {
				await visit(normalized)
			}
		} catch {
			if (targetExtensions.has(path.extname(normalized))) {
				files.push(normalized)
			}
		}
	}

	return [...new Set(files)].sort()
}

async function main() {
	const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'))
	const targets = process.argv.slice(2)
	const files = await expandTargets(targets.length > 0 ? targets : defaultTargets)
	let foundUnallowlisted = false

	for (const relativePath of files) {
		const source = await readFile(path.join(frontendDir, relativePath), 'utf8')
		const lines = source.split(/\r?\n/)

		lines.forEach((line, index) => {
			for (const literal of collectStringLiterals(line)) {
				const reason = findAllowlistReason(relativePath, literal, allowlist)
				const status = reason ? 'ALLOW' : 'TODO'
				if (!reason) {
					foundUnallowlisted = true
				}
				console.log(
					`${status}\t${relativePath}:${index + 1}\t${JSON.stringify(literal.trim())}\t${reason ?? 'unlocalized'}`
				)
			}
		})
	}

	if (foundUnallowlisted) {
		process.exitCode = 1
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
