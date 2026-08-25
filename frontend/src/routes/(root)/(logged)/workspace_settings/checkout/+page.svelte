<script lang="ts">
	import { goto } from '$lib/navigation'
	import { page } from '$app/state'
	import CenteredModal from '$lib/components/CenteredModal.svelte'
	import { Alert } from '$lib/components/common'
	import { WindmillIcon } from '$lib/components/icons'
	import { WorkspaceService } from '$lib/gen'
	import { locale, t } from '$lib/i18n'
	import { workspaceStore } from '$lib/stores'
	import { sendUserToast } from '$lib/toast'

	let success = page.url.searchParams.get('success') === 'true'

	let attempt = 0
	if (!success) {
		setTimeout(() => {
			goto('/workspace_settings?tab=premium')
		}, 5000)
	} else {
		let interval = setInterval(async () => {
			attempt += 1
			if ((await WorkspaceService.getSettings({ workspace: $workspaceStore! })).customer_id) {
				clearInterval(interval)
				goto('/workspace_settings?tab=premium')
			} else if (attempt > 10) {
				sendUserToast(t('workspaceCheckout.subscriptionUpgradeFailedToast'), true)
				clearInterval(interval)
				goto('/workspace_settings?tab=premium')
			}
		}, 5000)
	}
</script>

<!-- svelte-ignore missing_declaration -->
<CenteredModal title={success ? t('workspaceCheckout.subscriptionUpgradeSucceeded') : t('workspaceCheckout.subscriptionUpgradeFailed')}>
	{#if !success}
		<div class="my-2">
			<Alert type="error" title={($locale, t('workspaceCheckout.checkoutFailed'))}>
				{($locale, t('workspaceCheckout.checkoutFailedBody'))}
			</Alert>
		</div>
		<p class="text-sm my-6 text-primary">
			{($locale, t('workspaceCheckout.redirectingInFiveSeconds'))}
		</p>
	{:else}
		<p class="text-sm my-6 text-primary w-full text-center">
			{($locale, t('workspaceCheckout.waitingForUpgrade'))}
		</p>
	{/if}

	<div class="block m-auto w-20">
		<WindmillIcon height="80px" width="80px" spin="fast" />
	</div>
</CenteredModal>
