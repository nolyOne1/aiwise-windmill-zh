<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte'
	import { UserService } from '$lib/gen/services.gen'
	import { goto } from '$lib/navigation'
	import CenteredModal from '$lib/components/CenteredModal.svelte'
	import { Button } from '$lib/components/common'
	import Popover from '$lib/components/meltComponents/Popover.svelte'
	import {
		Search,
		Linkedin,
		Users,
		FileText,
		Github,
		Calendar,
		HelpCircle,
		Building2,
		Twitter,
		Youtube,
		Bot,
		MessageCircleCode
	} from 'lucide-svelte'
	import { sendUserToast } from '$lib/toast'
	import { locale, t } from '$lib/i18n'

	// Define step names as constants for better maintainability
	const STEP_SOURCE = 'source'
	const STEP_USE_CASE = 'use_case'

	type OnboardingStep = typeof STEP_SOURCE | typeof STEP_USE_CASE

	let currentStep = $state<OnboardingStep>(STEP_SOURCE)
	let useCaseText = $state('')
	let selectedSource = $state<string | null>(null)
	let isSubmitting = $state(false)
	let otherSourceText = $state('')
	let otherPopoverOpen = $state(false)
	let otherInputRef: HTMLInputElement | undefined = $state()

	const sources = $derived.by(() => {
		$locale
		return [
			{ id: 'ai_search', label: t('onboarding.sourceAiSearch'), icon: Bot },
			{ id: 'search_engine', label: t('onboarding.sourceSearchEngine'), icon: Search },
			{ id: 'reddit', label: 'Reddit', icon: MessageCircleCode },
			{ id: 'youtube', label: 'Youtube', icon: Youtube },
			{ id: 'github', label: 'GitHub', icon: Github },
			{ id: 'in_my_company', label: t('onboarding.sourceCurrentCompany'), icon: Building2 },
			{ id: 'word_of_mouth', label: t('onboarding.sourceWordOfMouth'), icon: Users },
			{ id: 'blog', label: t('onboarding.sourceBlog'), icon: FileText },
			{ id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
			{ id: 'twitter', label: 'X/Twitter', icon: Twitter },
			{ id: 'event', label: t('onboarding.sourceEvent'), icon: Calendar },
			{ id: 'other', label: t('onboarding.sourceOther'), icon: HelpCircle }
		]
	})

	// Focus the "Other" input when the popover opens
	$effect(() => {
		if (otherPopoverOpen && otherInputRef) {
			otherInputRef.focus()
		}
	})

	function selectSource(sourceId: string) {
		selectedSource = sourceId
		// Auto-advance to next step
		currentStep = STEP_USE_CASE
	}

	function validateOtherSource() {
		if (otherSourceText.trim()) {
			selectedSource = `other: ${otherSourceText.trim()}`
		} else {
			selectedSource = 'other'
		}
		otherPopoverOpen = false
		// Auto-advance to next step
		currentStep = STEP_USE_CASE
	}

	function goToPreviousStep() {
		currentStep = STEP_SOURCE
	}

	async function continueToWorkspaces() {
		if (!selectedSource || isSubmitting) return

		isSubmitting = true
		try {
			await UserService.submitOnboardingData({
				requestBody: {
					touch_point: selectedSource,
					use_case: useCaseText
				}
			})

			sendUserToast(t('onboarding.infoSaved'))
		} catch (error) {
			console.error('Error submitting onboarding data:', error)
			sendUserToast(
				t('onboarding.infoSaveFailed', { error: error?.body || error?.message || error }),
				true
			)
		} finally {
			// do not block users from accessing windmill even if there is an error
			goto('/user/workspaces')
		}
	}

	async function skip() {
		isSubmitting = true
		try {
			await UserService.submitOnboardingData({
				requestBody: {}
			})
		} catch (error) {
			console.error('Error skipping onboarding:', error)
		} finally {
			// do not block users from accessing windmill even if there is an error
			goto('/user/workspaces')
		}
	}
</script>

{#if currentStep === STEP_SOURCE}
	<CenteredModal title={$locale ? t('onboarding.hearAboutTitle') : t('onboarding.hearAboutTitle')}>
		<div class="w-full max-w-lg mx-auto">
			<div class="grid grid-cols-1 gap-2 mt-6 mb-6">
				{#each sources as source (source.id)}
					{#if source.id === 'other'}
						<Popover bind:isOpen={otherPopoverOpen} placement="bottom" contentClasses="p-4 w-96">
							{#snippet trigger()}
								<Button
									variant="default"
									unifiedSize="md"
									selected={selectedSource === 'other' || selectedSource?.startsWith('other:')}
									startIcon={{ icon: source.icon }}
									btnClasses="!justify-start w-full"
								>
									{source.label}
								</Button>
							{/snippet}
							{#snippet content()}
								<div class="flex flex-col gap-3">
									<input
										type="text"
										bind:this={otherInputRef}
										bind:value={otherSourceText}
										placeholder={$locale ? t('onboarding.typeAnswer') : t('onboarding.typeAnswer')}
										class="input"
									/>
									<Button variant="accent" unifiedSize="md" on:click={validateOtherSource}>
										{$locale ? t('onboarding.validate') : t('onboarding.validate')}
									</Button>
								</div>
							{/snippet}
						</Popover>
					{:else}
						<Button
							variant="default"
							unifiedSize="md"
							selected={selectedSource === source.id}
							startIcon={{ icon: source.icon }}
							btnClasses="!justify-start"
							on:click={() => selectSource(source.id)}
						>
							{source.label}
						</Button>
					{/if}
				{/each}
			</div>

			<div class="flex flex-row justify-end items-center pt-4">
				<Button color="light" variant="border" size="xs" on:click={skip} loading={isSubmitting}
					>{$locale ? t('onboarding.skip') : t('onboarding.skip')}</Button
				>
			</div>

			<div class="flex justify-center mt-4">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-blue-500"></div>
					<div class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
				</div>
			</div>
		</div>
	</CenteredModal>
{:else if currentStep === STEP_USE_CASE}
	<CenteredModal title={$locale ? t('onboarding.useCaseTitle') : t('onboarding.useCaseTitle')}>
		<div class="w-full max-w-lg mx-auto">
			<div class="mb-6">
				<textarea
					bind:value={useCaseText}
					placeholder={$locale
						? t('onboarding.useCasePlaceholder')
						: t('onboarding.useCasePlaceholder')}
					class="input mt-1"
					rows="8"
					maxlength="1000"
				></textarea>
			</div>

			<div class="flex flex-row justify-between items-center pt-4 gap-4">
				<Button
					color="light"
					variant="border"
					startIcon={{ icon: ArrowLeft }}
					size="xs"
					on:click={goToPreviousStep}
				>
					{$locale ? t('onboarding.previous') : t('onboarding.previous')}
				</Button>
				<Button
					color="blue"
					variant="contained"
					size="lg"
					disabled={isSubmitting}
					loading={isSubmitting}
					on:click={continueToWorkspaces}
				>
					{$locale ? t('common.continue') : t('common.continue')}
				</Button>
			</div>

			<div class="flex justify-center mt-4">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
					<div class="w-2 h-2 rounded-full bg-blue-500"></div>
				</div>
			</div>
		</div>
	</CenteredModal>
{/if}
