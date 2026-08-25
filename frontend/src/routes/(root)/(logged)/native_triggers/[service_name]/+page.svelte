<script lang="ts">
	import { NativeTriggerService } from '$lib/gen'
	import type { NativeServiceName } from '$lib/gen'
	import type { ExtendedNativeTrigger } from '$lib/components/triggers/native/utils'
	import {
		isServiceAvailable,
		formatTriggerDisplayName,
		getServiceConfig
	} from '$lib/components/triggers/native/utils'
	import NativeTriggerTable from '$lib/components/triggers/native/NativeTriggerTable.svelte'
	import NativeTriggerEditor from '$lib/components/triggers/native/NativeTriggerEditor.svelte'
	import {
		sendUserToast,
		removeTriggerKindIfUnused,
		getLocalSetting,
		storeLocalSetting
	} from '$lib/utils'
	import { userStore, workspaceStore, userWorkspaces, usedTriggerKinds } from '$lib/stores'
	import CenteredPage from '$lib/components/CenteredPage.svelte'
	import PageHeader from '$lib/components/PageHeader.svelte'
	import { Button, Alert, Skeleton } from '$lib/components/common'
	import { LoaderCircle, Plus } from 'lucide-svelte'
	import SearchItems from '$lib/components/SearchItems.svelte'
	import NoItemFound from '$lib/components/home/NoItemFound.svelte'
	import { page } from '$app/state'
	import Toggle from '$lib/components/Toggle.svelte'
	import ListFilters from '$lib/components/home/ListFilters.svelte'
	import { t } from '$lib/i18n'

	type TriggerW = ExtendedNativeTrigger & { marked?: any }

	const serviceName = $derived(page.params.service_name as NativeServiceName)
	const serviceConfig = $derived(getServiceConfig(serviceName))

	let triggers: TriggerW[] = $state([])
	let loading = $state(true)
	let serviceAvailable: boolean | undefined = $state(undefined)
	let serviceSupported = $state(true)
	let editor: NativeTriggerEditor

	let filteredItems: TriggerW[] = $state([])
	let items: TriggerW[] = $state([])
	let preFilteredItems: TriggerW[] = $state([])
	let filter = $state('')
	let ownerFilter: string | undefined = $state(undefined)
	let nbDisplayed = $state(15)

	const FILTER_USER_FOLDER_SETTING_NAME = 'native_trigger_user_and_folders_only'
	let filterUserFolders = $state(getLocalSetting(FILTER_USER_FOLDER_SETTING_NAME) == 'true')

	$effect(() => {
		storeLocalSetting(FILTER_USER_FOLDER_SETTING_NAME, filterUserFolders ? 'true' : undefined)
	})

	function filterItemsPathsBaseOnUserFilters(item: TriggerW, filterUserFolders: boolean) {
		if ($workspaceStore == 'admins') return true
		if (filterUserFolders) {
			return (
				!item.script_path.startsWith('u/') ||
				item.script_path.startsWith('u/' + $userStore?.username + '/')
			)
		} else {
			return true
		}
	}

	$effect(() => {
		preFilteredItems =
			ownerFilter != undefined
				? triggers?.filter(
						(x) =>
							x.script_path.startsWith(ownerFilter + '/') &&
							filterItemsPathsBaseOnUserFilters(x, filterUserFolders)
					)
				: triggers?.filter((x) => filterItemsPathsBaseOnUserFilters(x, filterUserFolders))
	})

	$effect(() => {
		if ($workspaceStore) {
			ownerFilter = undefined
		}
	})

	let owners = $derived(
		Array.from(
			new Set(filteredItems?.map((x) => x.script_path.split('/').slice(0, 2).join('/')) ?? [])
		).sort()
	)

	$effect(() => {
		items = filter !== '' ? filteredItems : preFilteredItems
	})

	async function checkServiceAvailability() {
		if (!serviceConfig) {
			serviceSupported = false
			return
		}

		if ($workspaceStore) {
			serviceAvailable = await isServiceAvailable(serviceName, $workspaceStore)
			if (!serviceAvailable) {
				sendUserToast(
					t('triggers.integrationNotAvailable', {
						kind: serviceConfig?.serviceDisplayName || serviceName
					}),
					true
				)
			}
		}
	}

	async function loadTriggers() {
		if (!$workspaceStore || !serviceAvailable) return

		loading = true
		try {
			const triggerList = await NativeTriggerService.listNativeTriggers({
				workspace: $workspaceStore,
				serviceName: serviceName
			})

			triggers = triggerList as TriggerW[]

			$usedTriggerKinds = removeTriggerKindIfUnused(triggers.length, serviceName, $usedTriggerKinds)
		} catch (err: any) {
			console.error('Failed to load triggers:', err)
			sendUserToast(t('triggers.failedToLoadTriggers', { error: err.body || err.message }), true)
		} finally {
			loading = false
		}
	}

	async function syncTriggers() {
		if (!serviceConfig?.supportsSync) {
			sendUserToast(t('triggers.syncNotSupported'))
			return
		}

		if (!serviceAvailable) {
			sendUserToast(t('triggers.cannotSyncTriggersNotConnected'), true)
			return
		}

		try {
			await NativeTriggerService.syncNativeTriggers({
				workspace: $workspaceStore!,
				serviceName: serviceName
			})

			sendUserToast(
				t('triggers.syncedTriggers', { kind: serviceConfig.serviceDisplayName })
			)
			loadTriggers()
		} catch (err: any) {
			const errorMessage = err.body || err.message
			if (
				errorMessage.includes('workspace integration') ||
				errorMessage.includes('not connected')
			) {
				sendUserToast(
					t('triggers.cannotSyncKindNotConnected', {
						kind: serviceConfig.serviceDisplayName
					}),
					true
				)
			} else {
				sendUserToast(t('triggers.failedToSyncTriggers', { error: errorMessage }), true)
			}
		}
	}

	$effect(() => {
		// Re-run when serviceName or workspace changes (e.g. navigating between /native_triggers/nextcloud and /google)
		void serviceName
		void $workspaceStore
		triggers = []
		serviceAvailable = undefined
		loading = true
		checkServiceAvailability().then(() => {
			if (serviceAvailable) {
				loadTriggers()
			}
		})
	})
</script>

<NativeTriggerEditor bind:this={editor} service={serviceName} onUpdate={loadTriggers} />

<SearchItems
	{filter}
	items={preFilteredItems}
	bind:filteredItems
	f={(trigger) => `${formatTriggerDisplayName(trigger)}`}
/>

{#if $userStore?.operator && $workspaceStore && !$userWorkspaces.find((_) => _.id === $workspaceStore)?.operator_settings?.triggers}
	<div class="bg-red-100 border-l-4 border-red-600 text-orange-700 p-4 m-4 mt-12" role="alert">
		<p class="font-bold">{t('common.unauthorized')}</p>
		<p>{t('common.pageNotAvailableForOperators')}</p>
	</div>
{:else if !serviceSupported}
	<CenteredPage>
		<div class="max-w-md mx-auto text-center py-12">
			<h2 class="text-lg font-semibold text-emphasis mb-2">{t('triggers.serviceNotSupported')}</h2>
			<p class="text-secondary text-xs mb-4">
				{t('triggers.serviceNotSupportedBody', { service: serviceName })}
			</p>
			<p class="text-xs text-secondary">{t('triggers.supportedServices', { services: 'nextcloud' })}</p>
		</div>
	</CenteredPage>
{:else}
	<CenteredPage>
		<PageHeader
			title={t('triggers.pageTitle', {
				kind: serviceConfig?.serviceDisplayName || serviceName
			})}
			tooltip="Native triggers managed externally by {serviceConfig?.serviceDisplayName ||
				serviceName}. These are more efficient than regular triggers as they're handled directly by the service provider."
		>
			<Button
				unifiedSize="md"
				variant="accent"
				startIcon={{ icon: Plus }}
				on:click={() => editor?.openNew()}
				disabled={!serviceAvailable}
			>
				{t('triggers.newTrigger', {
					kind: serviceConfig?.serviceDisplayName || serviceName
				})}
			</Button>
		</PageHeader>

		{#if serviceAvailable === false}
			<Alert
				title={t('triggers.notAvailableTitle', {
					kind: serviceConfig?.serviceDisplayName || serviceName
				})}
				type="warning"
			>
				<div class="flex flex-col gap-2 mt-2">
					{t('triggers.notAvailableBody', {
						kind: serviceConfig?.serviceDisplayName || serviceName
					})}
					<div class="flex gap-2">
						<Button variant="accent" href="/workspace_settings?tab=native_triggers">
							{t('triggers.manageNativeTriggers')}
						</Button>
						<Button variant="subtle" onclick={() => checkServiceAvailability()}
							>{t('triggers.retryCheck')}</Button
						>
					</div>
				</div>
			</Alert>
		{:else if serviceAvailable}
			<div class="w-full h-full flex flex-col">
				<div class="w-full pb-4 pt-6">
					<input
						type="text"
						placeholder={t('triggers.searchTriggers', {
							kind: serviceConfig?.serviceDisplayName || serviceName
						})}
						bind:value={filter}
						class="search-item mb-2"
					/>
					<ListFilters syncQuery bind:selectedFilter={ownerFilter} filters={owners} />
					<div class="flex flex-row items-center justify-end gap-4">
						{#if $userStore?.is_super_admin && $userStore.username.includes('@')}
							<Toggle
								size="xs"
								bind:checked={filterUserFolders}
								options={{ right: t('triggers.onlyFolders') }}
							/>
						{:else if $userStore?.is_admin || $userStore?.is_super_admin}
							<Toggle
								size="xs"
								bind:checked={filterUserFolders}
								options={{
									right: t('triggers.onlyUserAndFolders', { user: $userStore.username })
								}}
							/>
						{/if}
					</div>
				</div>

				{#if loading}
					{#each new Array(6) as _}
						<Skeleton layout={[[6], 0.4]} />
					{/each}
				{:else if !triggers?.length}
					<div class="text-center text-sm font-semibold text-emphasis mt-2">
						{t('triggers.noTriggers', {
							kind: serviceConfig?.serviceDisplayName || serviceName
						})}
					</div>
				{:else if items?.length}
					<NativeTriggerTable
						service={serviceName}
						triggers={items.slice(0, nbDisplayed)}
						{loading}
						onEdit={(trigger) => editor?.openEdit(trigger.external_id, trigger.is_flow)}
						onRecreate={(trigger) => editor?.openRecreate(trigger)}
						onSync={syncTriggers}
					/>
				{:else}
					<NoItemFound />
				{/if}
			</div>
			{#if items && items?.length > 15 && nbDisplayed < items.length}
				<span class="text-xs font-normal text-primary"
					>{t('schedules.itemsShown', { shown: nbDisplayed, total: items.length })}
					<button class="ml-4 font-semibold text-emphasis" onclick={() => (nbDisplayed += 30)}
						>{t('common.load30More')}</button
					></span
				>
			{/if}
		{:else}
			<div class="flex flex-col items-center justify-center h-64 gap-3">
				<LoaderCircle class="animate-spin text-accent-primary" size={32} />
				<div class="text-secondary text-xs">
					{t('triggers.checkingAvailability', {
						kind: serviceConfig?.serviceDisplayName || serviceName
					})}
				</div>
			</div>
		{/if}
	</CenteredPage>
{/if}
