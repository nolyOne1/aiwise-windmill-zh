<script lang="ts">
	import { WorkspaceService } from '$lib/gen'
	import { createEventDispatcher } from 'svelte'
	import { workspaceStore } from '$lib/stores'
	import { Button } from './common'
	import Drawer from './common/drawer/Drawer.svelte'
	import DrawerContent from './common/drawer/DrawerContent.svelte'
	import { sendUserToast } from '$lib/toast'
	import { Save } from 'lucide-svelte'
	import autosize from '$lib/autosize'
	import Label from './Label.svelte'
	import TextInput from './text_input/TextInput.svelte'
	import { locale, t } from '$lib/i18n'

	const dispatch = createEventDispatcher()

	let edit: boolean = $state(false)
	let name: string = $state('')
	let value: string = $state('')

	export function initNew(): void {
		edit = false
		name = ''
		value = ''
		drawer?.openDrawer()
	}

	export function editVariable(editName: string, editValue: string): void {
		edit = true
		name = editName
		value = editValue
		drawer?.openDrawer()
	}

	let drawer: Drawer | undefined = $state()

	async function updateVariable(): Promise<void> {
		await WorkspaceService.setEnvironmentVariable({
			workspace: $workspaceStore!,
			requestBody: {
				value: value,
				name: name
			}
		})
		sendUserToast(
			edit
				? t('contextualVariableEditor.updatedContextualVariable', { name })
				: t('contextualVariableEditor.createdContextualVariable', { name })
		)
		dispatch('update')

		drawer?.closeDrawer()
		setTimeout(() => {
			dispatch('update')
		}, 5000)
	}
</script>

<Drawer bind:this={drawer} size="900px">
	<DrawerContent
		title={
			edit
				? $locale ? t('contextualVariableEditor.updateTitle', { name }) : t('contextualVariableEditor.updateTitle', { name })
				: $locale ? t('contextualVariableEditor.createTitle') : t('contextualVariableEditor.createTitle')
		}
		on:close={drawer?.closeDrawer}
	>
		<div class="flex flex-col gap-8">
			{#if !edit}
				<Label for="name" label={$locale ? t('common.name') : t('common.name')}>
					<TextInput
						inputProps={{
							type: 'text',
							placeholder: $locale ? t('contextualVariableEditor.variableNamePlaceholder') : t('contextualVariableEditor.variableNamePlaceholder'),
							id: 'name'
						}}
						bind:value={name}
					/>
				</Label>
			{/if}
			<Label for="value" label={$locale ? t('common.value') : t('common.value')}>
				<textarea
					rows="4"
					use:autosize
					bind:value
					placeholder={$locale ? t('contextualVariableEditor.variableValuePlaceholder') : t('contextualVariableEditor.variableValuePlaceholder')}
					id="value"
				></textarea>
			</Label>
		</div>
		{#snippet actions()}
			<Button
				on:click={() => updateVariable()}
				disabled={value === '' || name === ''}
				startIcon={{ icon: Save }}
				variant="accent"
				unifiedSize="md"
			>
				{edit ? $locale ? t('common.update') : t('common.update') : $locale ? t('common.save') : t('common.save')}
			</Button>
		{/snippet}
	</DrawerContent>
</Drawer>
