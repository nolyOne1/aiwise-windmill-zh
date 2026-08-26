<script lang="ts">
	import { locale, t } from '$lib/i18n'
	interface Props {
		hasFilters?: boolean
		// When provided (home page), it's the authoritative list of active filters:
		// non-empty means the current filters are too narrow (and are listed to the
		// user); empty means the workspace itself has no items. Takes precedence over
		// `hasFilters`, which other callers still use as a plain boolean.
		activeFilters?: string[]
	}

	let { hasFilters = false, activeFilters }: Props = $props()

	let narrowed = $derived(activeFilters != undefined ? activeFilters.length > 0 : hasFilters)
</script>

{#if narrowed}
	<div class="flex justify-center items-center h-48">
		<div class="text-primary text-center max-w-md px-4">
			<div class="text-lg font-semibold text-emphasis"
				>{$locale ? t('home.noItemsMatch') : t('home.noItemsMatch')}</div
			>
			{#if activeFilters && activeFilters.length > 0}
				<div class="text-xs font-normal text-hint mt-1">
					{t('home.activeFilters', { filters: activeFilters.join(' · ') })}
				</div>
				<div class="text-xs font-normal text-hint mt-0.5"
					>{$locale ? t('home.clearOrWidenFilters') : t('home.clearOrWidenFilters')}</div
				>
			{:else}
				<div class="text-xs font-normal text-hint"
					>{$locale ? t('home.tryChangingFilters') : t('home.tryChangingFilters')}</div
				>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex justify-center items-center h-48">
		<div class="text-primary text-center">
			<div class="text-lg font-semibold text-emphasis"
				>{$locale ? t('home.welcome') : t('home.welcome')}</div
			>
			<div class="text-xs font-normal text-hint">
				{$locale ? t('home.getStarted') : t('home.getStarted')}
			</div>
		</div>
	</div>
{/if}
