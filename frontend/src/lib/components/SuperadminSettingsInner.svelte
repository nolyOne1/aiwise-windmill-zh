<script lang="ts">
	import { UserService, type GlobalUserInfo, type ExternalJwtToken, SettingService } from '$lib/gen'
	import { Tab, Tabs } from '$lib/components/common'
	import DataTable from '$lib/components/table/DataTable.svelte'
	import Head from '$lib/components/table/Head.svelte'
	import Cell from '$lib/components/table/Cell.svelte'
	import InviteGlobalUser from '$lib/components/InviteGlobalUser.svelte'
	import { Button } from '$lib/components/common'
	import { sendUserToast } from '$lib/toast'
	import { base } from '$lib/base'
	import SearchItems from './SearchItems.svelte'
	import { page } from '$app/state'
	import { replaceState } from '$app/navigation'
	import Version from './Version.svelte'
	import Uptodate from './Uptodate.svelte'
	import InstanceSettings from './InstanceSettings.svelte'
	import { truncate } from '$lib/utils'
	import ToggleButtonGroup from './common/toggleButton-v2/ToggleButtonGroup.svelte'
	import ToggleButton from './common/toggleButton-v2/ToggleButton.svelte'
	import { userStore, workspaceStore } from '$lib/stores'
	import {
		ArrowRightLeft,
		Ban,
		Bot,
		CheckCircle2,
		ExternalLink,
		Pencil,
		UserMinus,
		UserPlus
	} from 'lucide-svelte'
	import Badge from './common/badge/Badge.svelte'
	import Tooltip from './Tooltip.svelte'
	import DropdownV2 from './DropdownV2.svelte'
	import Popover from './meltComponents/Popover.svelte'
	import ConfirmationModal from './common/confirmationModal/ConfirmationModal.svelte'
	import GlobalUserOffboardingModal from '$lib/components/GlobalUserOffboardingModal.svelte'
	import ChangeInstanceUsername from './ChangeInstanceUsername.svelte'
	import { isCloudHosted } from '$lib/cloud'
	import InstanceNameEditor from './InstanceNameEditor.svelte'
	import Toggle from './Toggle.svelte'
	import { instanceSettingsSelectedTab } from '$lib/stores'
	import { onDestroy, tick } from 'svelte'
	import SidebarNavigation from '$lib/components/common/sidebar/SidebarNavigation.svelte'
	import {
		instanceSettingsNavigationGroups,
		tabToCategoryMap,
		tabToAuthSubTab,
		categoryToTabMap,
		buildSearchableSettingItems,
		type SearchableSettingItem
	} from './instanceSettings'
	import TextInput from './text_input/TextInput.svelte'
	import SettingsPageHeader from './settings/SettingsPageHeader.svelte'
	import SettingsSearchInput from './instanceSettings/SettingsSearchInput.svelte'
	import InstanceAISettings from './instanceSettings/InstanceAISettings.svelte'
	import ExternalJwtTokens from './instanceSettings/ExternalJwtTokens.svelte'
	import { locale, t } from '$lib/i18n'

	let filter = $state('')

	let {
		closeDrawer,
		showHeaderInfo = true,
		disableChatOffset = false,
		yamlMode = $bindable(false),
		hasUnsavedChanges = $bindable(false),
		hasAnyInvalid = $bindable(false)
	} = $props()

	function removeHash() {
		const index = page.url.href.lastIndexOf('#')
		if (index === -1) return
		const hashRemoved = page.url.href.slice(0, index)
		// Strip the drawer's URL hash without a SvelteKit navigation: a `goto`
		// here re-fires path-reactive effects on the underlying page (e.g. the
		// script editor's load effect), wiping unsaved editor content.
		try {
			replaceState(hashRemoved, page.state)
		} catch (e) {
			// replaceState throws if the router isn't initialized yet — possible
			// when onDestroy runs during router teardown.
			console.error(e)
		}
	}

	onDestroy(() => {
		removeHash()
	})

	let users: GlobalUserInfo[] = $state([])
	let filteredUsers: GlobalUserInfo[] = $state([])
	let offboardingEmail: string | undefined = $state(undefined)
	let offboardingReassignOnly = $state(false)
	let disableConfirmedCallback: (() => void) | undefined = $state(undefined)
	let disableUserEmail: string = $state('')
	let editWrappers: Record<string, HTMLDivElement> = $state({})
	let activeOnly = $state(false)

	async function listUsers(activeOnly: boolean): Promise<void> {
		users = await UserService.listUsersAsSuperAdmin({ perPage: 100000, activeOnly: activeOnly })
	}

	$effect(() => {
		listUsers(activeOnly)
	})

	let usersSubTab: 'users' | 'ext_jwt' = $state('users')
	let extJwtTokens: ExternalJwtToken[] = $state([])
	let extJwtHasMore = $state(true)
	let extJwtLoading = $state(false)
	let extJwtActiveOnly = $state(false)
	const extJwtPerPage = 50

	async function loadExtJwtPage(nextPage: number) {
		extJwtLoading = true
		try {
			const res = await UserService.listExtJwtTokens({
				page: nextPage,
				perPage: extJwtPerPage,
				activeOnly: extJwtActiveOnly
			})
			extJwtTokens = nextPage === 1 ? res : [...extJwtTokens, ...res]
			extJwtHasMore = res.length === extJwtPerPage
		} catch (e) {
			sendUserToast(`Failed to load external JWT tokens: ${e}`, true)
		} finally {
			extJwtLoading = false
		}
	}
	loadExtJwtPage(1)

	let tab: string = $state('users')

	$effect(() => {
		tab = $instanceSettingsSelectedTab
	})
	$effect(() => {
		instanceSettingsSelectedTab.set(tab)
	})

	let nbDisplayed = $state(50)

	let instanceSettings: InstanceSettings | undefined = $state()

	let automateUsernameCreation = $state(true)
	async function getAutomateUsernameCreationSetting() {
		automateUsernameCreation =
			((await SettingService.getGlobal({ key: 'automate_username_creation' })) as any) ?? true
	}
	getAutomateUsernameCreationSetting()
	let automateUsernameModalOpen = $state(false)
	async function enableAutomateUsernameCreationSetting() {
		await SettingService.setGlobal({
			key: 'automate_username_creation',
			requestBody: { value: true }
		})
		getAutomateUsernameCreationSetting()
		sendUserToast('Automatic username creation enabled')
		listUsers(activeOnly)
	}

	async function updateName(name: string | undefined, email: string) {
		try {
			await UserService.globalUserUpdate({
				email,
				requestBody: {
					name
				}
			})
			sendUserToast('User updated')
			listUsers(activeOnly)
		} catch (e) {
			sendUserToast('Error updating user', true)
		}
	}

	// The category name for InstanceSettings based on current sidebar tab
	let instanceSettingsCategory = $derived(tabToCategoryMap[tab] ?? 'Core')
	let authSubTab: 'sso' | 'oauth' | 'scim' = $derived(tabToAuthSubTab[tab] ?? 'sso')

	function handleNavigate(newTab: string) {
		if (newTab === tab) return
		tab = newTab
	}

	export function saveSettings() {
		return instanceSettings?.saveSettings()
	}

	export function discardAll() {
		instanceSettings?.discardAll()
	}

	export function syncBeforeDiff(): boolean {
		return instanceSettings?.syncBeforeDiff() ?? true
	}

	export function buildFullDiff(): { original: string; modified: string } {
		return instanceSettings?.buildFullDiff() ?? { original: '', modified: '' }
	}
	// --- Settings search ---
	const searchableItems = buildSearchableSettingItems()

	let scrollTimeout: ReturnType<typeof setTimeout> | undefined
	let highlightTimeout: ReturnType<typeof setTimeout> | undefined

	async function handleSearchSelect(item: SearchableSettingItem) {
		handleNavigate(item.tabId)
		if (item.settingKey) {
			clearTimeout(scrollTimeout)
			clearTimeout(highlightTimeout)
			await tick()
			// Wait for the tab content to render before scrolling
			scrollTimeout = setTimeout(() => {
				const el = document.querySelector(`[data-setting-key="${item.settingKey}"]`)
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' })
					el.classList.add('setting-highlight')
					highlightTimeout = setTimeout(() => el.classList.remove('setting-highlight'), 2500)
				}
			}, 100)
		}
	}

	onDestroy(() => {
		clearTimeout(scrollTimeout)
		clearTimeout(highlightTimeout)
	})
</script>

<SearchItems
	{filter}
	items={users}
	bind:filteredItems={filteredUsers}
	f={(x) =>
		(x.email ?? '') +
		' ' +
		(x.name ?? '') +
		' ' +
		(x.company ?? '') +
		' ' +
		(x.username ?? '') +
		' ' +
		(x.workspace_id ?? '')}
/>

<div class="flex flex-col h-full w-full">
	{#if showHeaderInfo}
		<div>
			<div class="flex justify-between">
				<div class="text-xs pt-1 text-secondary flex flex-col">
					<div>Windmill <Version /></div>
				</div>
				<div><Uptodate /></div></div
			>
		</div>
		{#if $workspaceStore !== 'admins'}
			<div class="flex flex-row-reverse">
				<Button
					variant="default"
					target="_blank"
					href="{base}/?workspace=admins"
					endIcon={{ icon: ExternalLink }}
				>
					Admins workspace
				</Button>
			</div>
		{/if}
	{/if}
	<div class="{showHeaderInfo ? 'pt-4' : ''} flex grow min-h-0">
		{#if !yamlMode}
			<!-- Sidebar Navigation -->
			<div class="w-52 shrink-0 h-full overflow-auto p-4 bg-surface flex flex-col">
				<SettingsSearchInput {searchableItems} onSelect={handleSearchSelect} class="mb-3" />
				<SidebarNavigation
					groups={instanceSettingsNavigationGroups}
					selectedId={tab}
					onNavigate={handleNavigate}
				/>
				{#if $workspaceStore !== 'admins'}
					<div class="mt-4 pt-2 border-t border-surface-hover">
						<a
							href="{base}/?workspace=admins"
							target="_blank"
							class="flex items-center gap-2 px-2 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
						>
							<ExternalLink size={14} />
							Admins workspace
						</a>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Main Content -->
		<div class="flex-1 min-w-0 h-full">
			<div class="h-full overflow-auto bg-surface">
				<div class="h-fit px-8 py-4">
					{#if tab === 'ai' && !yamlMode}
						<InstanceAISettings {disableChatOffset} />
					{:else if tab === 'users' && !yamlMode}
						<div class="h-full">
							{#if !automateUsernameCreation && !isCloudHosted()}
								<div class="mb-4">
									<h3 class="mb-2"> {($locale, t('superadmin.automaticUsernameCreation'))} </h3>
									<div class="mb-2">
										<span class="text-primary text-sm"
											>{($locale, t('superadmin.automaticUsernameCreationDescription'))} <a
												target="_blank"
												href="https://www.windmill.dev/docs/advanced/instance_settings#automatic-username-creation"
												>{($locale, t('common.learnMore'))}</a
											></span
										>
									</div>
									<Button
										btnClasses="w-auto"
										size="sm"
										variant="accent"
										on:click={() => {
											automateUsernameModalOpen = true
										}}
									>
										{($locale, t('superadmin.enableRecommended'))}
									</Button>
									<ConfirmationModal
										open={automateUsernameModalOpen}
										on:confirmed={() => {
											automateUsernameModalOpen = false
											enableAutomateUsernameCreationSetting()
										}}
										on:canceled={() => (automateUsernameModalOpen = false)}
										title={($locale, t('superadmin.automaticUsernameCreation'))}
										confirmationText={($locale, t('superadmin.enable'))}
									>
										{($locale, t('superadmin.automaticUsernameCreationConfirm'))}
									</ConfirmationModal>
								</div>
							{/if}

							{#if extJwtTokens.length > 0}
								<Tabs bind:selected={usersSubTab} class="mb-4">
									<Tab value="users" label={($locale, t('workspaceSettings.users'))} />
									<Tab value="ext_jwt" label={($locale, t('superadmin.externalJwts'))} />
								</Tabs>
							{/if}

							{#if usersSubTab === 'users' || extJwtTokens.length === 0}
								<SettingsPageHeader
									title={t('superadmin.instanceUsersTitle', { count: users.length })}
									description={t('superadmin.instanceUsersDescription')}
									link="https://www.windmill.dev/docs/advanced/instance_settings#global-users"
								/>
								<div class="flex flex-row gap-2 items-center">
									<TextInput
										inputProps={{ placeholder: t('superadmin.searchUsers') }}
										bind:value={filter}
										class="w-60"
									/><Toggle
										bind:checked={activeOnly}
										options={{
											left: t('superadmin.recentlyActiveOnly'),
											leftTooltip:
												t('superadmin.recentlyActiveOnlyTooltip')
										}}
									/>

									<div class="flex-1"></div>
									<Popover placement="bottom-end" disableFocusTrap closeButton>
										{#snippet trigger()}
											<Button
												variant="accent"
												unifiedSize="md"
												startIcon={{ icon: UserPlus }}
												nonCaptureEvent
												wrapperClasses="w-fit shrink-0"
											>
												{($locale, t('superadmin.addNewUser'))}
											</Button>
										{/snippet}
										{#snippet content()}
											<InviteGlobalUser on:new={() => listUsers(activeOnly)} />
										{/snippet}
									</Popover>
								</div>
								<p class="text-hint text-2xs mt-2">
									{t('superadmin.usersFound', { count: filteredUsers.length })}
								</p>
								<div class="mt-1">
									<DataTable
										shouldLoadMore={(filteredUsers?.length ?? 0) > 50}
										loadMore={50}
										on:loadMore={() => {
											nbDisplayed += 50
										}}
									>
										<Head>
											<tr>
												<Cell head first>{($locale, t('common.email'))}</Cell>
												{#if automateUsernameCreation}
													<Cell head>{($locale, t('common.username'))}</Cell>
												{/if}
												<Cell head>{($locale, t('common.name'))}</Cell>
												<Cell head>{($locale, t('superadmin.auth'))}</Cell>
												{#if activeOnly}
													<Cell head>{($locale, t('superadmin.kind'))}</Cell>
												{/if}
												<Cell head>{($locale, t('superadmin.role'))}</Cell>
												<Cell head last>
													<span class="sr-only">{($locale, t('superadmin.actions'))}</span>
												</Cell>
											</tr>
										</Head>
										<tbody>
											{#if filteredUsers && users}
												{#each filteredUsers.slice(0, nbDisplayed) as { email, super_admin, devops, login_type, name, username, operator_only, is_workspace_admin, role_source, disabled, workspace_id }, i (email + '::' + (workspace_id ?? ''))}
													{@const isServiceAccount = login_type === 'service_account'}
													<tr
														class="{i % 2 === 0 ? 'bg-surface-tertiary' : 'bg-surface'} {disabled
															? 'opacity-60'
															: ''}"
													>
														<Cell first class="max-w-[250px]">
															<div class="flex items-center gap-1.5">
																{#if isServiceAccount}
																	<Bot size={16} class="text-blue-500 shrink-0" />
																	<span title={email} class="truncate block">{email}</span>
																{:else}
																	<a href="mailto:{email}" title={email} class="truncate block"
																		>{email}</a
																	>
																{/if}
																{#if workspace_id}
																	<a
																		href="{base}/?workspace={workspace_id}"
																		title={t('superadmin.workspaceTitle', { workspace: workspace_id })}
																	>
																		<Badge color="blue">{truncate(workspace_id, 20)}</Badge>
																	</a>
																{/if}
																{#if disabled}
																	<span
																		class="text-2xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 whitespace-nowrap"
																		>{($locale, t('common.disabled'))}</span
																	>
																{/if}
															</div>
														</Cell>
														{#if automateUsernameCreation}
															<Cell class="max-w-[150px]">
																{#if username}
																	<span title={username} class="truncate block">{username}</span>
																{:else}
																	{#key filteredUsers.map((u) => u.username).join()}
																		<ChangeInstanceUsername
																			username=""
																			{email}
																			isConflict
																			on:renamed={() => {
																				listUsers(activeOnly)
																			}}
																		/>
																	{/key}
																{/if}
															</Cell>
														{/if}
														<Cell class="max-w-[150px]"
															><span title={name ?? ''} class="truncate block"
																>{truncate(name ?? '', 30)}</span
															></Cell
														>
														<Cell class="max-w-[100px]"
															><span title={login_type} class="truncate block">{login_type}</span
															></Cell
														>
														{#if activeOnly}
															<Cell>
																{#if is_workspace_admin}
																	{($locale, t('superadmin.admin'))}
																{:else if operator_only}
																	{($locale, t('superadmin.operatorOnly'))}
																{:else}
																	{($locale, t('superadmin.developer'))}
																{/if}
															</Cell>
														{/if}
														<Cell>
															{#if isServiceAccount}
																<div class="flex items-center gap-1">
																	<span
																		class="rounded-md text-xs px-2 py-1 bg-surface shadow-md font-bold"
																	>
																		{is_workspace_admin
																			? t('superadmin.admin')
																			: operator_only
																				? t('superadmin.operator')
																				: t('superadmin.developer')}
																	</span>
																	<Tooltip>
																		{($locale, t('superadmin.serviceAccountRoleTooltip'))}
																	</Tooltip>
																</div>
															{:else}
																<div class="flex flex-col items-start">
																	{#key `${super_admin}_${devops}_${role_source}`}
																		<ToggleButtonGroup
																			selected={super_admin
																				? 'super_admin'
																				: devops
																					? 'devops'
																					: 'user'}
																			on:selected={async (e) => {
																				if (email == $userStore?.email) {
																					sendUserToast(t('superadmin.cannotDemoteYourself'), true)
																					listUsers(activeOnly)
																					return
																				}

																				let role = e.detail

																				if (role === 'super_admin') {
																					await UserService.globalUserUpdate({
																						email,
																						requestBody: {
																							is_super_admin: true,
																							is_devops: false
																						}
																					})
																				}
																				if (role === 'devops') {
																					await UserService.globalUserUpdate({
																						email,
																						requestBody: {
																							is_super_admin: false,
																							is_devops: true
																						}
																					})
																				}
																				if (role === 'user') {
																					await UserService.globalUserUpdate({
																						email,
																						requestBody: {
																							is_super_admin: false,
																							is_devops: false
																						}
																					})
																				}
																				sendUserToast(t('superadmin.userUpdated'))
																				listUsers(activeOnly)
																			}}
																		>
																			{#snippet children({ item })}
																				<ToggleButton
																					value={'user'}
																					small
																					label={t('superadmin.user')}
																					disabled={role_source === 'instance_group' &&
																						(super_admin || devops)}
																					tooltip={role_source === 'instance_group' &&
																					(super_admin || devops)
																						? t('superadmin.instanceGroupRoleTooltip')
																						: undefined}
																					showTooltipIcon={role_source === 'instance_group' &&
																						(super_admin || devops)}
																					{item}
																				/>
																				<ToggleButton
																					value={'devops'}
																					small
																					label={t('superadmin.devops')}
																					tooltip={t('superadmin.devopsTooltip')}
																					{item}
																				/>
																				<ToggleButton
																					value={'super_admin'}
																					small
																					label={t('superadmin.superadmin')}
																					{item}
																				/>
																			{/snippet}
																		</ToggleButtonGroup>
																	{/key}
																	{#if role_source === 'instance_group' && (super_admin || devops)}
																		<a
																			href="{base}/groups"
																			class="text-2xs text-tertiary mt-0.5 ml-1 hover:underline"
																			title={t('superadmin.instanceGroupRoleTitle')}
																			onclick={() => closeDrawer?.()}
																		>
																			{($locale, t('superadmin.setByInstanceGroup'))}
																		</a>
																	{/if}
																</div>
															{/if}
														</Cell>
														<Cell last>
															<div class="flex items-center justify-end">
																{#if isServiceAccount}
																	{#if workspace_id}
																		<a
																			href="{base}/workspace_settings?tab=users&workspace={workspace_id}"
																			class="text-xs text-secondary hover:text-primary hover:underline"
																			title={t('superadmin.manageInWorkspace')}>{($locale, t('superadmin.manageInWorkspace'))}</a
																		>
																	{/if}
																{:else}
																	<div
																		bind:this={editWrappers[email]}
																		class="w-0 h-0 overflow-hidden"
																	>
																		<InstanceNameEditor
																			{login_type}
																			value={name}
																			{username}
																			{email}
																			on:refresh={() => {
																				listUsers(activeOnly)
																			}}
																			on:save={(e) => {
																				updateName(e.detail, email)
																			}}
																			on:renamed={() => {
																				listUsers(activeOnly)
																			}}
																			{automateUsernameCreation}
																		/>
																	</div>
																	<DropdownV2
																		items={[
																			{
																				displayName: t('common.edit'),
																				icon: Pencil,
																				action: () => {
																					const btn = editWrappers[email]?.querySelector(
																						'[aria-label="Popup button"]'
																					)
																					if (btn instanceof HTMLElement) btn.click()
																				}
																			},
																			{
																				displayName: disabled ? t('superadmin.enable') : t('superadmin.disable'),
																				icon: disabled ? CheckCircle2 : Ban,
																				action: () => {
																					if (!disabled) {
																						disableUserEmail = email
																						disableConfirmedCallback = async () => {
																							try {
																								await UserService.globalUserUpdate({
																									email,
																									requestBody: { disabled: true }
																								})
																								sendUserToast(t('superadmin.userDisabled'))
																								listUsers(activeOnly)
																							} catch (e) {
																								sendUserToast(t('superadmin.disableUserFailed'), true)
																							}
																						}
																					} else {
																						UserService.globalUserUpdate({
																							email,
																							requestBody: { disabled: false }
																						})
																							.then(() => {
																								sendUserToast(t('superadmin.userEnabled'))
																								listUsers(activeOnly)
																							})
																							.catch(() => {
																								sendUserToast(t('superadmin.enableUserFailed'), true)
																							})
																					}
																				}
																			},
																			{
																				displayName: t('superadmin.reassign'),
																				icon: ArrowRightLeft,
																				action: () => {
																					offboardingEmail = email
																					offboardingReassignOnly = true
																				}
																			},
																			{
																				displayName: t('common.remove'),
																				icon: UserMinus,
																				type: 'delete',
																				action: () => {
																					offboardingEmail = email
																					offboardingReassignOnly = false
																				}
																			}
																		]}
																	/>
																{/if}
															</div>
														</Cell>
													</tr>
												{/each}
											{/if}
										</tbody>
									</DataTable>
								</div>
							{:else if usersSubTab === 'ext_jwt'}
								<ExternalJwtTokens
									tokens={extJwtTokens}
									hasMore={extJwtHasMore}
									loading={extJwtLoading}
									activeOnly={extJwtActiveOnly}
									onLoadMore={() =>
										loadExtJwtPage(Math.floor(extJwtTokens.length / extJwtPerPage) + 1)}
									onActiveOnlyChange={(v) => {
										extJwtActiveOnly = v
										loadExtJwtPage(1)
									}}
								/>
							{/if}
						</div>
					{:else}
						<InstanceSettings
							bind:this={instanceSettings}
							hideTabs
							bind:yamlMode
							bind:hasUnsavedChanges
							bind:hasAnyInvalid
							tab={instanceSettingsCategory}
							{authSubTab}
							{closeDrawer}
							onNavigateToTab={(category) => {
								const targetTab = categoryToTabMap[category]
								if (targetTab) {
									handleNavigate(targetTab)
								}
							}}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
{#if offboardingEmail}
	<GlobalUserOffboardingModal
		open={offboardingEmail != null}
		email={offboardingEmail}
		reassignOnly={offboardingReassignOnly}
		onClose={() => {
			offboardingEmail = undefined
		}}
		onComplete={() => {
			offboardingEmail = undefined
			listUsers(activeOnly)
		}}
	/>
{/if}
<ConfirmationModal
	open={Boolean(disableConfirmedCallback)}
	title={($locale, t('superadmin.disableUser'))}
	confirmationText={($locale, t('superadmin.disable'))}
	on:canceled={() => {
		disableConfirmedCallback = undefined
		listUsers(activeOnly)
	}}
	on:confirmed={() => {
		if (disableConfirmedCallback) {
			disableConfirmedCallback()
		}
		disableConfirmedCallback = undefined
	}}
>
	<div class="flex flex-col w-full space-y-4">
		<span
			>{@html t('superadmin.disableUserConfirm', { email: `<b>${disableUserEmail}</b>` })}</span
		>
	</div>
</ConfirmationModal>
