<script lang="ts">
	import { workspaceStore } from '$lib/stores'
	import { sendUserToast } from '$lib/utils'
	import { Button, Alert } from '$lib/components/common'
	import Skeleton from '$lib/components/common/skeleton/Skeleton.svelte'
	import SettingsPageHeader from '$lib/components/settings/SettingsPageHeader.svelte'
	import { Check, X, ExternalLink, Cog, Plug } from 'lucide-svelte'
	import { NextcloudIcon, GithubIcon } from '$lib/components/icons'
	import GoogleIcon from '$lib/components/icons/GoogleIcon.svelte'
	import { WorkspaceIntegrationService, type NativeServiceName } from '$lib/gen'
	import ClipboardPanel from '$lib/components/details/ClipboardPanel.svelte'
	import OAuthClientConfig from './OAuthClientConfig.svelte'
	import ConfirmationModal from '../common/confirmationModal/ConfirmationModal.svelte'
	import { createAsyncConfirmationModal } from '../common/confirmationModal/asyncConfirmationModal.svelte'
	import Path from '$lib/components/Path.svelte'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { locale, t } from '$lib/i18n'

	interface WorkspaceIntegration {
		service_name: string
		resource_path?: string
		oauth_data: {
			client_id: string
			client_secret: string
			base_url: string
			instance_shared?: boolean
		} | null
	}

	interface ServiceConfig {
		name: string
		displayName: string
		description: string
		icon: any
		docsUrl?: string
		requiresBaseUrl?: boolean
		clientIdPlaceholder?: string
		clientSecretPlaceholder?: string
		setupInstructions?: string[]
	}

	const supportedServices: Record<string, ServiceConfig> = {
		nextcloud: {
			name: 'nextcloud',
			displayName: 'Nextcloud',
			description: t('workspaceIntegrations.nextcloudDescription'),
			icon: NextcloudIcon,
			docsUrl: 'https://www.windmill.dev/docs/integrations/nextcloud',
			setupInstructions: [
				t('workspaceIntegrations.nextcloudSetup1'),
				t('workspaceIntegrations.nextcloudSetup2'),
				t('workspaceIntegrations.nextcloudSetup3')
			]
		},
		google: {
			name: 'google',
			displayName: 'Google',
			description: t('workspaceIntegrations.googleDescription'),
			icon: GoogleIcon,
			docsUrl: 'https://www.windmill.dev/docs/core_concepts/native_triggers#google-triggers',
			requiresBaseUrl: false,
			clientIdPlaceholder: t('workspaceIntegrations.googleClientIdPlaceholder'),
			clientSecretPlaceholder: t('workspaceIntegrations.googleClientSecretPlaceholder'),
			setupInstructions: [
				t('workspaceIntegrations.googleSetup1'),
				t('workspaceIntegrations.googleSetup2'),
				t('workspaceIntegrations.googleSetup3'),
				t('workspaceIntegrations.googleSetup4'),
				t('workspaceIntegrations.googleSetup5')
			]
		},
		github: {
			name: 'github',
			displayName: 'GitHub',
			description: t('workspaceIntegrations.githubDescription'),
			icon: GithubIcon,
			docsUrl: 'https://www.windmill.dev/docs/core_concepts/native_triggers#github-triggers',
			requiresBaseUrl: false,
			clientIdPlaceholder: t('workspaceIntegrations.githubClientIdPlaceholder'),
			clientSecretPlaceholder: t('workspaceIntegrations.githubClientSecretPlaceholder'),
			setupInstructions: [
				t('workspaceIntegrations.githubSetup1'),
				t('workspaceIntegrations.githubSetup2'),
				t('workspaceIntegrations.githubSetup3'),
				t('workspaceIntegrations.githubSetup4')
			]
		}
	}

	let integrations = $state<WorkspaceIntegration[]>([])
	let loading = $state(false)
	let connecting = $state<string | null>(null)
	let showingConfig = $state<string | null>(null)
	let instanceSharingAvailable = $state<Record<string, boolean>>({})
	let pendingCallback = $state<{
		serviceName: NativeServiceName
		code: string
		state: string
		workspace: string
	} | null>(null)
	let resourcePath = $state<string | undefined>(undefined)
	let pathError = $state<string | undefined>(undefined)
	let confirmationModal = createAsyncConfirmationModal()

	async function loadIntegrations() {
		if (!$workspaceStore) return

		loading = true
		try {
			const response = await WorkspaceIntegrationService.listNativeTriggerServices({
				workspace: $workspaceStore
			})
			integrations = response.map((item) => ({
				service_name: item.service_name,
				resource_path: item.resource_path ?? undefined,
				oauth_data: item.oauth_data || null
			}))
		} catch (err: any) {
			console.error('Failed to load workspace integrations:', err)
			sendUserToast(t('workspaceIntegrations.failedToLoad', { error: err.message }), true)
		} finally {
			loading = false
		}
	}

	async function deleteIntegration(serviceName: string) {
		if (!$workspaceStore) return

		const displayName = supportedServices[serviceName]?.displayName ?? serviceName
		const confirmed = await confirmationModal.ask({
			title: t('workspaceIntegrations.disconnectTitle', { name: displayName }),
			confirmationText: t('workspaceIntegrations.disconnect'),
			children: t('workspaceIntegrations.disconnectBody', { name: displayName })
		})
		if (!confirmed) return

		try {
			await WorkspaceIntegrationService.deleteNativeTriggerService({
				workspace: $workspaceStore,
				serviceName: serviceName as any
			})
			sendUserToast(t('workspaceIntegrations.disconnectedSuccessfully', { name: displayName }))
			loadIntegrations()
		} catch (err: any) {
			sendUserToast(t('workspaceIntegrations.failedToDisconnect', { name: displayName, error: err.message }), true)
		}
	}

	async function connectService(serviceName: string, redirectUri: string) {
		if (!$workspaceStore) return

		connecting = serviceName
		try {
			const auth_url = await WorkspaceIntegrationService.generateNativeTriggerServiceConnectUrl({
				workspace: $workspaceStore,
				serviceName: serviceName as any,
				requestBody: { redirect_uri: redirectUri }
			})

			if (auth_url) {
				window.location.href = auth_url
			}
		} catch (err: any) {
			sendUserToast(
				t('workspaceIntegrations.failedToConnect', {
					name: supportedServices[serviceName]?.displayName ?? serviceName,
					error: err.message
				}),
				true
			)
			connecting = null
		}
	}

	async function createOrUpdateIntegration(serviceName: string, oauthData: any) {
		if (!$workspaceStore) return

		try {
			await WorkspaceIntegrationService.createNativeTriggerService({
				workspace: $workspaceStore,
				serviceName: serviceName as any,
				requestBody: oauthData
			})
			sendUserToast(
				t('workspaceIntegrations.configurationSavedSuccessfully', {
					name: supportedServices[serviceName]?.displayName ?? serviceName
				})
			)
			loadIntegrations()
		} catch (err: any) {
			sendUserToast(
				t('workspaceIntegrations.failedToConfigure', {
					name: supportedServices[serviceName]?.displayName ?? serviceName,
					error: err.message
				}),
				true
			)
		}
	}

	async function checkInstanceSharing() {
		if (!$workspaceStore) return

		for (const serviceName of Object.keys(supportedServices)) {
			try {
				const available = await WorkspaceIntegrationService.checkInstanceSharingAvailable({
					workspace: $workspaceStore,
					serviceName: serviceName as NativeServiceName
				})
				instanceSharingAvailable[serviceName] = available
			} catch {
				instanceSharingAvailable[serviceName] = false
			}
		}
	}

	async function connectWithInstanceCredentials(serviceName: string) {
		if (!$workspaceStore) return

		connecting = serviceName
		try {
			const redirectUri = getRedirectUri(serviceName)
			const auth_url = await WorkspaceIntegrationService.generateInstanceConnectUrl({
				workspace: $workspaceStore,
				serviceName: serviceName as NativeServiceName,
				requestBody: { redirect_uri: redirectUri }
			})

			if (auth_url) {
				window.location.href = auth_url
			}
		} catch (err: any) {
			sendUserToast(
				t('workspaceIntegrations.failedToConnect', {
					name: supportedServices[serviceName]?.displayName ?? serviceName,
					error: err.message
				}),
				true
			)
			connecting = null
		}
	}

	function isConfigured(integration: WorkspaceIntegration): boolean {
		if (integration.oauth_data === null) return false
		if (integration.oauth_data.instance_shared) return true
		const serviceConfig = supportedServices[integration.service_name]
		const needsBaseUrl = serviceConfig?.requiresBaseUrl !== false
		return (
			!!integration.oauth_data.client_id &&
			!!integration.oauth_data.client_secret &&
			(!needsBaseUrl || !!integration.oauth_data.base_url)
		)
	}

	function isConnected(integration: WorkspaceIntegration): boolean {
		if (integration.oauth_data?.instance_shared) {
			return !!integration.resource_path
		}
		return isConfigured(integration) && !!integration.resource_path
	}

	function getIntegrationByService(serviceName: string): WorkspaceIntegration | null {
		return integrations.find((integration) => integration.service_name === serviceName) || null
	}

	function handleOAuthCallback(
		workspace: string,
		serviceName: NativeServiceName,
		code: string,
		state: string
	) {
		// Phase 1: store callback params and clean URL — don't call backend yet
		pendingCallback = { serviceName, code, state, workspace }

		// Pre-populate resource path from existing integration (for reconnect)
		const integration = getIntegrationByService(serviceName)
		resourcePath = integration?.resource_path ?? undefined

		const url = new URL(page.url)
		url.searchParams.delete('code')
		url.searchParams.delete('state')
		url.searchParams.delete('service')
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true })
	}

	async function finalizePendingCallback() {
		if (!pendingCallback) return

		const { serviceName, code, state, workspace } = pendingCallback
		try {
			const redirectUri = getRedirectUri(serviceName)
			await WorkspaceIntegrationService.nativeTriggerServiceCallback({
				serviceName,
				workspace,
				requestBody: {
					code,
					state,
					redirect_uri: redirectUri,
					resource_path: resourcePath
				}
			})
			sendUserToast(
				t('workspaceIntegrations.connectedSuccessfully', {
					name: supportedServices[serviceName]?.displayName ?? serviceName
				})
			)
			await loadIntegrations()
		} catch (err: any) {
			sendUserToast(t('workspaceIntegrations.failedToCompleteOAuth', { error: err.message }), true)
		} finally {
			pendingCallback = null
			resourcePath = undefined
			pathError = undefined
		}
	}

	$effect(() => {
		if (
			page.url.searchParams.has('code') &&
			page.url.searchParams.has('state') &&
			page.url.searchParams.has('service') &&
			$workspaceStore
		) {
			const service = page.url.searchParams.get('service')! as NativeServiceName
			const code = page.url.searchParams.get('code')!
			const state = page.url.searchParams.get('state')!
			handleOAuthCallback($workspaceStore, service, code, state)
		}
	})

	function getRedirectUri(serviceName: string): string {
		return `${window.location.origin}/workspace_settings?tab=native_triggers&service=${serviceName}`
	}

	$effect(() => {
		if ($workspaceStore) {
			loadIntegrations()
			checkInstanceSharing()
		}
	})
</script>

<div class="flex flex-col">
	<SettingsPageHeader
		title={$locale ? t('workspaceIntegrations.title') : t('workspaceIntegrations.title')}
		description={$locale ? t('workspaceIntegrations.description') : t('workspaceIntegrations.description')}
		link="https://www.windmill.dev/docs/core_concepts/native_triggers"
	/>

	{#if pendingCallback}
		{@const serviceName = pendingCallback.serviceName}
		{@const config = supportedServices[serviceName]}
		<div class="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-surface-tertiary">
			<div class="text-sm font-semibold text-emphasis mb-2">
				{$locale ? t('workspaceIntegrations.saveCredentialsAsResource', {
					name: config?.displayName ?? serviceName
				}) : t('workspaceIntegrations.saveCredentialsAsResource', {
					name: config?.displayName ?? serviceName
				})}
			</div>
			<div class="text-xs text-secondary mb-3">
				{$locale ? t('workspaceIntegrations.saveCredentialsDescription') : t('workspaceIntegrations.saveCredentialsDescription')}
			</div>
			<Path
				kind="resource"
				initialPath={resourcePath ?? ''}
				namePlaceholder={'native_' + serviceName}
				bind:path={resourcePath}
				bind:error={pathError}
			/>
			<div class="flex gap-2 mt-3">
				<Button
					variant="accent"
					disabled={!resourcePath || !!pathError}
					onclick={finalizePendingCallback}
				>
					{$locale ? t('common.save') : t('common.save')}
				</Button>
				<Button
					onclick={() => {
						pendingCallback = null
						resourcePath = undefined
						pathError = undefined
					}}
				>
					{$locale ? t('common.cancel') : t('common.cancel')}
				</Button>
			</div>
		</div>
	{:else if loading}
		<div class="space-y-4">
			{#each new Array(3) as _}
				<Skeleton layout={[[6], 0.4]} />
			{/each}
		</div>
	{:else}
		<div class="space-y-4">
			{#each Object.entries(supportedServices) as [serviceName, config]}
				{@const integration = getIntegrationByService(serviceName)}
				{@const isConnecting = connecting === serviceName}
				{@const isOAuthConfigured = integration && isConfigured(integration)}
				{@const isServiceConnected = integration && isConnected(integration)}
				{@const isShowingConfig = showingConfig === serviceName}

				<div class="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-surface-tertiary">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 flex items-center justify-center">
								<config.icon class="w-6 h-6" />
							</div>
							<div class="flex flex-col">
								<div class="text-sm font-semibold text-emphasis">{config.displayName}</div>
								<div class="text-xs font-normal text-primary">{config.description}</div>
							</div>
						</div>

						<div class="flex items-center gap-2">
							{#if isServiceConnected}
								<div class="flex items-center gap-1 text-green-600 text-xs">
									<Check size={16} />
									<span class="font-semibold">{$locale ? t('workspaceIntegrations.connected') : t('workspaceIntegrations.connected')}</span>
								</div>
								<Button
									onclick={() =>
										integration?.oauth_data?.instance_shared
											? connectWithInstanceCredentials(serviceName)
											: connectService(serviceName, getRedirectUri(serviceName))}
									disabled={isConnecting}
									startIcon={{ icon: Plug }}
								>
									{isConnecting
										? $locale ? t('workspaceIntegrations.reconnecting') : t('workspaceIntegrations.reconnecting')
										: $locale ? t('workspaceIntegrations.reconnect') : t('workspaceIntegrations.reconnect')}
								</Button>
								<Button
									destructive
									onclick={() => deleteIntegration(serviceName)}
									startIcon={{ icon: X }}
								>
									{$locale ? t('common.delete') : t('common.delete')}
								</Button>
							{:else if isOAuthConfigured}
								<Button
									variant="accent"
									onclick={() => connectService(serviceName, getRedirectUri(serviceName))}
									disabled={isConnecting}
									startIcon={{ icon: Plug }}
								>
									{isConnecting
										? $locale ? t('workspaceIntegrations.connecting') : t('workspaceIntegrations.connecting')
										: $locale ? t('workspaceIntegrations.connect') : t('workspaceIntegrations.connect')}
								</Button>
								<Button
									destructive
									onclick={() => deleteIntegration(serviceName)}
									startIcon={{ icon: X }}
								>
									{$locale ? t('common.delete') : t('common.delete')}
								</Button>
							{:else if instanceSharingAvailable[serviceName]}
								<Button
									variant="accent"
									onclick={() => connectWithInstanceCredentials(serviceName)}
									disabled={isConnecting}
									startIcon={{ icon: Plug }}
								>
									{isConnecting
										? $locale ? t('workspaceIntegrations.connecting') : t('workspaceIntegrations.connecting')
										: $locale ? t('workspaceIntegrations.connect') : t('workspaceIntegrations.connect')}
								</Button>
							{:else}
								<Button
									variant="accent"
									onclick={() =>
										(showingConfig = showingConfig === serviceName ? null : serviceName)}
									startIcon={{ icon: Cog }}
								>
									{$locale ? t('workspaceIntegrations.configureOAuth') : t('workspaceIntegrations.configureOAuth')}
								</Button>
							{/if}

							{#if config.docsUrl}
								<Button href={config.docsUrl} target="_blank" startIcon={{ icon: ExternalLink }}>
									{$locale ? t('workspaceIntegrations.docs') : t('workspaceIntegrations.docs')}
								</Button>
							{/if}
						</div>
					</div>

					{#if instanceSharingAvailable[serviceName] && !isOAuthConfigured}
						<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
							<Alert type="info" title={$locale ? t('workspaceIntegrations.redirectUriRequired') : t('workspaceIntegrations.redirectUriRequired')}>
								<p class="text-sm mb-2">
									{$locale ? t('workspaceIntegrations.redirectUriDescriptionPrefix') : t('workspaceIntegrations.redirectUriDescriptionPrefix')}
									<a
										href="https://console.cloud.google.com/apis/credentials"
										target="_blank"
										rel="noopener noreferrer"
										class="underline">Google Cloud Console</a
									>{$locale ? t('workspaceIntegrations.redirectUriDescriptionSuffix') : t('workspaceIntegrations.redirectUriDescriptionSuffix')}
								</p>
								<ClipboardPanel content={getRedirectUri(serviceName)} size="sm" />
							</Alert>
						</div>
					{/if}

					{#if isShowingConfig}
						<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
							{#if serviceName === 'nextcloud'}
								<Alert type="info" title={$locale ? t('workspaceIntegrations.requirements') : t('workspaceIntegrations.requirements')} class="mb-4">
									<p>{$locale ? t('workspaceIntegrations.nextcloudRequirementsTitle') : t('workspaceIntegrations.nextcloudRequirementsTitle')}</p>
									<ul class="list-disc pl-4 mt-2 space-y-1">
										<li>{$locale ? t('workspaceIntegrations.nextcloudRequirement1') : t('workspaceIntegrations.nextcloudRequirement1')}</li>
										<li>
											The <a
												href="https://apps.nextcloud.com/apps/integration_windmill"
												target="_blank"
												rel="noopener noreferrer"
												class="underline hover:text-blue-600"
											>
												Windmill integration app
											</a>{$locale ? t('workspaceIntegrations.nextcloudRequirement2') : t('workspaceIntegrations.nextcloudRequirement2')}
										</li>
										<li>
											<a
												href="https://docs.nextcloud.com/server/latest/admin_manual/installation/source_installation.html#pretty-urls"
												target="_blank"
												rel="noopener noreferrer"
												class="underline hover:text-blue-600"
											>
												Pretty URLs
											</a>
											{$locale ? t('workspaceIntegrations.nextcloudRequirement3') : t('workspaceIntegrations.nextcloudRequirement3')}
										</li>
									</ul>
								</Alert>
							{/if}
							<OAuthClientConfig
								{serviceName}
								redirectUri={getRedirectUri(serviceName)}
								serviceDisplayName={config.displayName}
								existingConfig={integration?.oauth_data}
								requiresBaseUrl={config.requiresBaseUrl !== false}
								clientIdPlaceholder={config.clientIdPlaceholder}
								clientSecretPlaceholder={config.clientSecretPlaceholder}
								setupInstructions={config.setupInstructions}
								onConfigSaved={async (oauthData) => {
									await createOrUpdateIntegration(serviceName, oauthData)
									showingConfig = null
								}}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if integrations.length === 0}
			<Alert type="warning" title={$locale ? t('workspaceIntegrations.noIntegrationsConnected') : t('workspaceIntegrations.noIntegrationsConnected')}>
				{$locale ? t('workspaceIntegrations.noIntegrationsConnectedBody') : t('workspaceIntegrations.noIntegrationsConnectedBody')}
			</Alert>
		{/if}
	{/if}
</div>

<ConfirmationModal {...confirmationModal.props} />
