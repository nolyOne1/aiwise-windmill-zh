<script lang="ts">
	import ToggleButton from '$lib/components/common/toggleButton-v2/ToggleButton.svelte'
	import ToggleButtonGroup from '$lib/components/common/toggleButton-v2/ToggleButtonGroup.svelte'
	import { LOCALE_LABELS, locale, setLocale, t, type Locale } from '$lib/i18n'

	function handleSelect(next: string) {
		setLocale(next as Locale)
	}
</script>

<div class="flex flex-col gap-2 pt-1">
	<div class="text-xs text-secondary">{($locale, t('account.language'))}</div>
	<ToggleButtonGroup
		selected={$locale}
		noWFull
		class="w-fit"
		tabListClass="gap-1"
		onSelected={handleSelect}
	>
		{#snippet children({ item })}
			<ToggleButton value="zh-CN" label={LOCALE_LABELS['zh-CN']} size="sm" {item} />
			<ToggleButton value="en-US" label={LOCALE_LABELS['en-US']} size="sm" {item} />
		{/snippet}
	</ToggleButtonGroup>
</div>
