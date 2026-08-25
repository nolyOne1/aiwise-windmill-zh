import type { AppDictionary } from './en-US'
import type { PartialLocaleDictionary } from '../types'

export const zhCN = {
	common: {
		save: '保存'
	},
	jobs: {
		count: '{count} 个作业'
	}
} as const satisfies PartialLocaleDictionary<AppDictionary>
