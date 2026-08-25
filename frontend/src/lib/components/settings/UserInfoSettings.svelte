<script lang="ts">
	import { usersWorkspaceStore } from '$lib/stores'
	import { UserService } from '$lib/gen'
	import { Button } from '$lib/components/common'
	import { sendUserToast } from '$lib/toast'
	import TextInput from '../text_input/TextInput.svelte'
	import { locale, t } from '$lib/i18n'

	let newPassword = $state<string | undefined>(undefined)
	let passwordError = $state<string | undefined>(undefined)
	let login_type = $state<string>('none')

	$effect(() => {
		loadLoginType()
	})

	async function loadLoginType(): Promise<void> {
		login_type = (await UserService.globalWhoami()).login_type
	}

	async function setPassword(): Promise<void> {
		if (newPassword) {
			await UserService.setPassword({
				requestBody: {
					password: newPassword
				}
			})
			sendUserToast(t('userInfo.passwordUpdated'))
		} else {
			sendUserToast(t('userInfo.specifyPassword'), true)
		}
	}
</script>

<div class="border border-border-light rounded-md p-4 h-full">
	<h2 class="text-emphasis text-sm font-semibold mb-2">{($locale, t('userInfo.title'))}</h2>

	<form class="flex flex-col gap-6">
		<div class="w-full text-primary flex flex-col gap-1">
			<div class="text-xs text-emphasis font-semibold">{($locale, t('common.email'))}</div>
			<span class="text-xs font-normal text-primary">
				{$usersWorkspaceStore?.email}
			</span>
		</div>

		<label class="flex flex-col gap-1 w-120">
			<span class="text-xs text-emphasis font-semibold">{($locale, t('common.password'))}</span>
			{#if login_type == 'password'}
				<div class="flex flex-row gap-1 items-center">
					<TextInput
						inputProps={{ autocomplete: 'new-password', type: 'password' }}
						bind:value={newPassword}
						error={passwordError}
					/>
					<Button
						size="sm"
						variant="default"
						btnClasses="w-min whitespace-nowrap"
						on:click={setPassword}>{($locale, t('userInfo.setPassword'))}</Button
					>
				</div>
				{#if passwordError}
					<div class="text-red-600 text-2xs">{passwordError}</div>
				{/if}
			{:else if login_type == 'github'}
				<span class="text-xs text-primary font-normal"
					>{($locale, t('userInfo.authenticatedGithub'))}</span
				>
			{/if}
		</label>
	</form>
</div>
