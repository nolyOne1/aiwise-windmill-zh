import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(currentDir, '..')

function normalizePlaceholders(input) {
	return [...input.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

function comparePlaceholderLists(reference, candidate) {
	if (reference.length !== candidate.length) return false
	return reference.every((value, index) => value === candidate[index])
}

function isPlainObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flattenDictionary(dictionary, prefix = '') {
	const entries = new Map()
	const errors = []

	for (const [key, value] of Object.entries(dictionary)) {
		const fullKey = prefix ? `${prefix}.${key}` : key

		if (typeof value === 'string') {
			if (value.trim().length === 0) {
				errors.push(`Empty value at ${fullKey}`)
			}
			entries.set(fullKey, value)
			continue
		}

		if (!isPlainObject(value)) {
			errors.push(`Non-string leaf at ${fullKey}`)
			continue
		}

		const nested = flattenDictionary(value, fullKey)
		nested.entries.forEach((nestedValue, nestedKey) => {
			entries.set(nestedKey, nestedValue)
		})
		errors.push(...nested.errors)
	}

	return { entries, errors }
}

function extractObjectLiteral(source) {
	const match = source.match(/export const \w+\s*=\s*(\{[\s\S]*\})\s*as const satisfies/m)

	if (!match) {
		throw new Error('Could not locate exported locale object')
	}

	return match[1]
}

function parseTypeScriptLocale(source) {
	const objectLiteral = extractObjectLiteral(
		source.replace(/^import\s+type\s+.+$/gm, '').replace(/^import\s+.+$/gm, '')
	)

	return Function(`return (${objectLiteral})`)()
}

export async function loadLocaleFile(filePath) {
	if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
		const imported = await import(pathToFileURL(filePath).href)
		return imported.default ?? imported.enUS ?? imported.zhCN ?? imported
	}

	const source = await readFile(filePath, 'utf8')
	return parseTypeScriptLocale(source)
}

export function validateLocalePair(referenceDictionary, candidateDictionary) {
	const reference = flattenDictionary(referenceDictionary)
	const candidate = flattenDictionary(candidateDictionary)
	const failures = [...reference.errors, ...candidate.errors]

	for (const key of reference.entries.keys()) {
		if (!candidate.entries.has(key)) {
			failures.push(`Missing key: ${key}`)
			continue
		}

		const referencePlaceholders = normalizePlaceholders(reference.entries.get(key))
		const candidatePlaceholders = normalizePlaceholders(candidate.entries.get(key))

		if (!comparePlaceholderLists(referencePlaceholders, candidatePlaceholders)) {
			failures.push(
				`Placeholder mismatch at ${key}: expected {${referencePlaceholders.join(', ')}}, got {${candidatePlaceholders.join(', ')}}`
			)
		}
	}

	for (const key of candidate.entries.keys()) {
		if (!reference.entries.has(key)) {
			failures.push(`Extra key: ${key}`)
		}
	}

	if (failures.length > 0) {
		throw new Error(failures.join('\n'))
	}

	return {
		keys: [...reference.entries.keys()].sort()
	}
}

async function main() {
	const english = await loadLocaleFile(path.join(frontendDir, 'src/lib/i18n/locales/en-US.ts'))
	const chinese = await loadLocaleFile(path.join(frontendDir, 'src/lib/i18n/locales/zh-CN.ts'))
	const result = validateLocalePair(english, chinese)

	console.log(`i18n dictionaries validated: ${result.keys.length} keys`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
