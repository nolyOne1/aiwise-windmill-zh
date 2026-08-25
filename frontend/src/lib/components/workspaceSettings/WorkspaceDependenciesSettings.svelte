<script lang="ts">
	import { Button, Skeleton } from '$lib/components/common'
	import ListFilters from '$lib/components/home/ListFilters.svelte'
	import SearchItems from '$lib/components/SearchItems.svelte'
	import Cell from '$lib/components/table/Cell.svelte'
	import DataTable from '$lib/components/table/DataTable.svelte'
	import Head from '$lib/components/table/Head.svelte'
	import Row from '$lib/components/table/Row.svelte'
	import WorkspaceDependenciesEditor from '$lib/components/WorkspaceDependenciesEditor.svelte'
	import DependenciesDeploymentWarning from '$lib/components/DependenciesDeploymentWarning.svelte'
	import Drawer from '$lib/components/common/drawer/Drawer.svelte'
	import DrawerContent from '$lib/components/common/drawer/DrawerContent.svelte'
	import HighlightCode from '$lib/components/HighlightCode.svelte'
	import { workspaceStore, userStore } from '$lib/stores'
	import { Plus, FileText, Search, Code2, Edit, Eye, RefreshCw } from 'lucide-svelte'
	import { WorkspaceDependenciesService, WorkspaceService } from '$lib/gen'
	import type { WorkspaceDependencies, ScriptLang } from '$lib/gen'
	import { untrack } from 'svelte'
	import { sendUserToast } from '$lib/toast'
	import TimeAgo from '$lib/components/TimeAgo.svelte'
	import SettingsPageHeader from '$lib/components/settings/SettingsPageHeader.svelte'
	import { locale, t } from '$lib/i18n'

	let filter = $state('')
	let workspaceDependencies: WorkspaceDependencies[] | undefined = $state()
	let filteredItems: (WorkspaceDependencies & { marked?: string })[] | undefined = $state()
	let workspaceDependenciesEditor: WorkspaceDependenciesEditor | undefined = $state()
	let rebuildingDependencyMap = $state(false)

	// View modal state
	let viewDrawer: Drawer | undefined = $state()
	let viewContent: string = $state('')
	let viewLanguage: ScriptLang = $state('python3')
	let viewPath: string = $state('')

	// Dependency warning state
	let showDependencyWarning = $state(false)
	let pendingAction: (() => Promise<void>) | null = $state(null)
	let currentImportedPath: string | null = $state(null)
	let warningTitle = $state('')
	let warningConfirmText = $state('')

	let languages = $derived(
		Array.from(new Set(filteredItems?.map((x) => x.language).filter(Boolean) ?? [])).sort()
	)

	let languageFilter: string | undefined = $state(undefined)

	$effect(() => {
		if ($workspaceStore) {
			languageFilter = undefined
		}
	})

	let preFilteredItems = $derived(
		languageFilter == undefined
			? workspaceDependencies
			: workspaceDependencies?.filter((x) => x.language === languageFilter)
	)

	// Load workspace dependencies using actual API
	async function loadWorkspaceDependencies(): Promise<void> {
		if (!$workspaceStore) return

		try {
			workspaceDependencies = await WorkspaceDependenciesService.listWorkspaceDependencies({
				workspace: $workspaceStore
			})
		} catch (error) {
			console.error('Failed to load workspace dependencies:', error)
			sendUserToast(t('workspaceDependencies.failedToLoad'), true)
		}
	}

	$effect(() => {
		if ($workspaceStore && $userStore) {
			untrack(() => {
				loadWorkspaceDependencies()
			})
		}
	})

	async function rebuildDependencyMap(): Promise<void> {
		if (!$workspaceStore) return
		rebuildingDependencyMap = true
		try {
			const status = await WorkspaceService.rebuildDependencyMap({ workspace: $workspaceStore })
			sendUserToast(status)
		} catch (error) {
			console.error('Error rebuilding dependency map:', error)
			sendUserToast(t('workspaceDependencies.failedToRebuildMap', { error: error.message }), true)
		} finally {
			rebuildingDependencyMap = false
		}
	}

	async function createNewWorkspaceDependencies() {
		await workspaceDependenciesEditor?.initNew()
	}

	function editWorkspaceDependencies(deps: WorkspaceDependencies) {
		workspaceDependenciesEditor?.editWorkspaceDependencies(deps.id, deps.name, deps.language)
	}

	function viewWorkspaceDependencies(deps: WorkspaceDependencies) {
		viewPath = deps.name || `Workspace Default (${deps.language})`
		viewContent = deps.content
		viewLanguage = deps.language
		viewDrawer?.openDrawer()
	}

	// Archive workspace dependencies
	async function archiveWorkspaceDependencies(deps: WorkspaceDependencies): Promise<void> {
		const importedPath = workspaceDependenciesEditor?.getWorkspaceDependenciesPath(
			deps.name ?? null,
			deps.language
		)
		if (!importedPath) {
			sendUserToast(t('workspaceDependencies.unableToDeterminePath'), true)
			return
		}

		currentImportedPath = importedPath
		warningTitle = t('workspaceDependencies.archiveWarning')
		warningConfirmText = t('workspaceDependencies.archiveAnyway')
		pendingAction = () => executeArchive(deps)
		showDependencyWarning = true
	}

	async function executeArchive(deps: WorkspaceDependencies): Promise<void> {
		try {
			await WorkspaceDependenciesService.archiveWorkspaceDependencies({
				workspace: $workspaceStore!,
				language: deps.language as any,
				name: deps.name
			})
			sendUserToast(
				t('workspaceDependencies.archived', {
					name: workspaceDependenciesEditor?.getDisplayName(deps) ?? ''
				})
			)
			loadWorkspaceDependencies() // Reload the list
		} catch (error) {
			console.error('Error archiving workspace dependencies:', error)
			sendUserToast(t('workspaceDependencies.failedToArchive', { error: error.message }), true)
		}
	}

	// Delete workspace dependencies
	async function deleteWorkspaceDependencies(deps: WorkspaceDependencies): Promise<void> {
		const importedPath = workspaceDependenciesEditor?.getWorkspaceDependenciesPath(
			deps.name ?? null,
			deps.language
		)
		if (!importedPath) {
			sendUserToast(t('workspaceDependencies.unableToDeterminePath'), true)
			return
		}

		currentImportedPath = importedPath
		warningTitle = t('workspaceDependencies.deleteWarning')
		warningConfirmText = t('workspaceDependencies.deleteAnyway')
		pendingAction = () => executeDelete(deps)
		showDependencyWarning = true
	}

	async function executeDelete(deps: WorkspaceDependencies): Promise<void> {
		try {
			await WorkspaceDependenciesService.deleteWorkspaceDependencies({
				workspace: $workspaceStore!,
				language: deps.language as any,
				name: deps.name
			})
			sendUserToast(
				t('workspaceDependencies.deleted', {
					name: workspaceDependenciesEditor?.getDisplayName(deps) ?? ''
				})
			)
			loadWorkspaceDependencies() // Reload the list
		} catch (error) {
			console.error('Error deleting workspace dependencies:', error)
			sendUserToast(t('workspaceDependencies.failedToDelete', { error: error.message }), true)
		}
	}

	async function viewReferencedFrom(deps: WorkspaceDependencies): Promise<void> {
		try {
			const path = workspaceDependenciesEditor?.getWorkspaceDependenciesPath(
				deps.name ?? null,
				deps.language
			)
			if (!path) {
				sendUserToast(t('workspaceDependencies.unableToDeterminePath'), true)
				return
			}

			const dependents = await WorkspaceService.getDependents({
				workspace: $workspaceStore!,
				importedPath: path
			})

			if (dependents.length === 0) {
				sendUserToast(t('workspaceDependencies.noDependentRunnables'))
			} else {
				// Show dependents in a modal or navigate to a detailed view
				console.log('Dependents:', dependents)
				sendUserToast(t('workspaceDependencies.foundDependentRunnables', { count: dependents.length }))
			}
		} catch (error) {
			console.error('Error fetching dependent runnables:', error)
			sendUserToast(t('workspaceDependencies.failedToFetchDependents'), true)
		}
	}

	async function handleWarningConfirm(): Promise<void> {
		if (pendingAction) {
			showDependencyWarning = false
			await pendingAction()
			pendingAction = null
			currentImportedPath = null
		}
	}

	function handleWarningCancel(): void {
		showDependencyWarning = false
		pendingAction = null
		currentImportedPath = null
	}

	function getLanguageForHighlighting(language: ScriptLang): ScriptLang | 'json' | undefined {
		// Map our requirement languages to syntax highlighting languages
		switch (language) {
			case 'python3':
				return 'python3'
			case 'bun':
				return 'json'
			case 'go':
				return 'go'
			case 'php':
				return 'json'
		}
	}
</script>

<WorkspaceDependenciesEditor
	bind:this={workspaceDependenciesEditor}
	on:create={loadWorkspaceDependencies}
/>

<SearchItems
	{filter}
	items={preFilteredItems}
	bind:filteredItems
	f={(x) => (x.name || 'Default') + ' ' + (x.language || '') + ' ' + (x.content || '')}
/>

<SettingsPageHeader
	title={($locale, t('workspaceDependencies.title'))}
	description={($locale, t('workspaceDependencies.description'))}
	link="https://www.windmill.dev/docs/core_concepts/workspace_dependencies"
>
	{#snippet actions()}
		<Button
			unifiedSize="md"
			variant="accent"
			startIcon={{ icon: Plus }}
			onClick={createNewWorkspaceDependencies}
		>
			{$locale, t('workspaceDependencies.newButton')}
		</Button>
	{/snippet}
</SettingsPageHeader>

<div class="pt-2">
	<div class="relative text-tertiary">
		<input
			placeholder={($locale, t('workspaceDependencies.searchPlaceholder'))}
			bind:value={filter}
			class="bg-surface !h-10 !px-4 !pr-10 !rounded-lg text-sm focus:outline-none w-full"
		/>
		<button aria-label={($locale, t('common.search'))} type="submit" class="absolute right-0 top-0 mt-3 mr-4">
			<Search class="h-4 w-4" />
		</button>
	</div>
</div>

<div class="min-h-[56px]">
	<ListFilters bind:selectedFilter={languageFilter} filters={languages} />
</div>

<div class="relative overflow-x-auto pb-8 pr-4">
	{#if !filteredItems}
		<Skeleton layout={[0.5, [2], 1]} />
		{#each new Array(3) as _}
			<Skeleton layout={[[3.5], 0.5]} />
		{/each}
	{:else if filteredItems.length == 0}
		<div class="flex flex-col items-center justify-center h-full py-12">
			<FileText size={48} class="text-secondary mb-4" />
			<div class="text-md font-medium">{$locale, t('workspaceDependencies.noDependenciesFound')}</div>
			<div class="text-sm text-secondary mb-4">
				{$locale, t('workspaceDependencies.noDependenciesFoundHint')}
			</div>
			<Button startIcon={{ icon: Plus }} on:click={createNewWorkspaceDependencies}>
				{$locale, t('workspaceDependencies.createFirst')}
			</Button>
		</div>
	{:else}
		<DataTable size="xs">
			<Head>
				<tr>
					<Cell head first>{$locale, t('common.name')}</Cell>
					<Cell head>{$locale, t('workspaceDependencies.language')}</Cell>
					<Cell head>{$locale, t('common.description')}</Cell>
					<Cell head>{$locale, t('workspaceDependencies.type')}</Cell>
					<Cell head>{$locale, t('workspaceDependencies.edited')}</Cell>
					<Cell head last>{$locale, t('workspaceDependencies.actions')}</Cell>
				</tr>
			</Head>
			<tbody class="divide-y">
				{#each filteredItems as deps}
					<Row>
						<Cell first>
							<div class="flex items-center gap-2">
								<FileText size={16} class="text-secondary" />
								<div class="flex flex-col">
									<button
										class="break-all hover:text-primary cursor-pointer font-medium text-left"
										onclick={() => editWorkspaceDependencies(deps)}
									>
										{#if deps.marked}
											{@html deps.marked}
										{:else}
											{workspaceDependenciesEditor?.getDisplayName(deps) ||
												deps.name ||
												`Default (${deps.language})`}
										{/if}
									</button>
									<span class="text-xs text-tertiary font-mono">
										{workspaceDependenciesEditor?.getFullFilename(deps.language, deps.name ?? null)}
										• {deps.language}
									</span>
								</div>
							</div>
						</Cell>
						<Cell>
							<div class="flex items-center gap-1">
								<Code2 size={14} class="text-secondary" />
								<span class="text-xs font-mono text-secondary">
									{deps.language || 'python3'}
								</span>
							</div>
						</Cell>
						<Cell>
							<span class="text-xs text-tertiary" title={deps.description}>
								{deps.description || '-'}
							</span>
						</Cell>
						<Cell>
							<span
								class="text-xs px-1.5 py-0.5 rounded bg-opacity-50 font-medium"
								class:bg-blue-100={deps.name === null}
								class:text-blue-700={deps.name === null}
								class:bg-gray-100={deps.name !== null}
								class:text-gray-600={deps.name !== null}
							>
								{deps.name === null
									? ($locale, t('common.default'))
									: ($locale, t('workspaceDependencies.named'))}
							</span>
						</Cell>
						<Cell>
							<span class="text-2xs text-secondary">
								<TimeAgo date={deps.created_at || ''} />
							</span>
						</Cell>
						<Cell last>
							<div class="flex gap-1 flex-wrap">
								<Button
									size="xs"
									variant="border"
									color="light"
									startIcon={{ icon: Eye }}
									on:click={() => viewWorkspaceDependencies(deps)}
								>
									{$locale, t('common.view')}
								</Button>
								<Button
									size="xs"
									variant="border"
									color="light"
									startIcon={{ icon: Edit }}
									on:click={() => editWorkspaceDependencies(deps)}
								>
									{$locale, t('common.edit')}
								</Button>
								<!-- Placeholder buttons -->
								<Button
									size="xs"
									variant="border"
									color="gray"
									on:click={() => archiveWorkspaceDependencies(deps)}
									title={($locale, t('workspaceDependencies.archive'))}
								>
									{$locale, t('workspaceDependencies.archive')}
								</Button>
								<Button
									size="xs"
									variant="border"
									color="red"
									on:click={() => deleteWorkspaceDependencies(deps)}
									title={($locale, t('common.delete'))}
								>
									{$locale, t('common.delete')}
								</Button>
								<Button
									size="xs"
									variant="border"
									color="gray"
									on:click={() => viewReferencedFrom(deps)}
									title={($locale, t('workspaceDependencies.referencedFrom'))}
								>
									{$locale, t('workspaceDependencies.refs')}
								</Button>
							</div>
						</Cell>
					</Row>
				{/each}
			</tbody>
		</DataTable>
	{/if}
</div>

{#if $userStore?.is_admin || $userStore?.is_super_admin}
	<div class="border-t pt-8 mt-16 pb-12 pr-4 flex items-start justify-between gap-4">
		<div class="flex flex-col gap-0.5 min-w-0">
			<span class="text-xs font-medium text-secondary">{$locale, t('workspaceDependencies.rebuildMap')}</span>
			<span class="text-xs text-tertiary max-w-2xl">
				{$locale, t('workspaceDependencies.rebuildMapDescription')}
			</span>
		</div>
		<Button
			size="xs"
			variant="border"
			color="light"
			startIcon={{ icon: RefreshCw }}
			disabled={rebuildingDependencyMap}
			onClick={rebuildDependencyMap}
		>
			{$locale, t('workspaceDependencies.rebuild')}
		</Button>
	</div>
{/if}

<Drawer bind:this={viewDrawer} size="900px">
	<DrawerContent
		title={($locale, t('workspaceDependencies.viewRequirementTitle', { path: viewPath }))}
		on:close={viewDrawer?.closeDrawer}
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<Code2 size={16} class="text-secondary" />
				<span class="text-sm font-mono text-secondary">{viewLanguage}</span>
			</div>
		{/snippet}

		<div class="space-y-4">
			{#if viewContent}
				<HighlightCode language={getLanguageForHighlighting(viewLanguage)} code={viewContent} />
			{:else}
				<div class="text-center text-secondary py-8">
					<FileText size={48} class="mx-auto mb-4 opacity-50" />
					<p>{$locale, t('workspaceDependencies.noContentAvailable')}</p>
				</div>
			{/if}
		</div>
	</DrawerContent>
</Drawer>

{#if showDependencyWarning && currentImportedPath}
	<DependenciesDeploymentWarning
		importedPath={currentImportedPath}
		title={warningTitle}
		confirmText={warningConfirmText}
		onConfirm={handleWarningConfirm}
		onCancel={handleWarningCancel}
	/>
{/if}
