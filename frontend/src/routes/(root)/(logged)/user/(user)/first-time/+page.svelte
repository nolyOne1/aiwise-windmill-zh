<script lang="ts">
	import { goto } from '$lib/navigation'

	import CenteredModal from '$lib/components/CenteredModal.svelte'
	import { Button } from '$lib/components/common'
	import { workspaceStore } from '$lib/stores'
	import { locale, t } from '$lib/i18n'

	async function startSetup(advanced = false): Promise<void> {
		$workspaceStore = 'admins'
		goto(advanced ? '/user/instance_settings?mode=full' : '/user/instance_settings')
	}

	async function decline(): Promise<void> {
		goto('/user/workspaces')
	}
</script>

<CenteredModal title={$locale ? t('onboarding.welcomeTitle') : t('onboarding.welcomeTitle')}>
	<p class="text-center text-secondary mt-4 mb-4">
		{$locale ? t('onboarding.welcomeBody') : t('onboarding.welcomeBody')}
	</p>
	<div class="flex flex-row justify-between pt-4 gap-x-1">
		<Button color="light" variant="contained" unifiedSize="md" on:click={decline}
			>{$locale ? t('onboarding.skip') : t('onboarding.skip')}</Button
		>
		<div class="flex items-center gap-2">
			<Button variant="default" unifiedSize="md" on:click={() => startSetup(true)}
				>{$locale ? t('onboarding.advancedSetup') : t('onboarding.advancedSetup')}</Button
			>
			<Button variant="accent" unifiedSize="md" on:click={() => startSetup()}
				>{$locale ? t('onboarding.quickSetup') : t('onboarding.quickSetup')}</Button
			>
		</div>
	</div>
</CenteredModal>
