<script lang="ts">
	import { goto } from '$app/navigation';
	import { loginChronosUserAccount, registerChronosUserAccount } from '$lib/api/GameClient';
	import '../mainpage.css';

	let usernameInputValue = '';
	let passwordInputValue = '';
	let confirmPasswordInputValue = '';
	let registrationErrorMessage: string | null = null;

	async function handleRegister() {
		registrationErrorMessage = null;
		if (!usernameInputValue.trim()) {
			registrationErrorMessage = 'Username is required.';
			return;
		}
		if (!passwordInputValue) {
			registrationErrorMessage = 'Password is required.';
			return;
		}
		if (passwordInputValue !== confirmPasswordInputValue) {
			registrationErrorMessage = 'Passwords do not match.';
			return;
		}

		try {
			await registerChronosUserAccount(usernameInputValue.trim(), passwordInputValue);
			await loginChronosUserAccount(usernameInputValue.trim(), passwordInputValue);
			goto('/');
		} catch (error) {
			console.error(error);
			registrationErrorMessage = 'Could not create account.';
		}
	}
</script>

<svelte:head>
	<title>Register – Chronos</title>
</svelte:head>

<div class="page-shell">
	<section class="content-panel">
		<header class="panel-header">
			<h1 class="panel-title">Create your account</h1>
			<p class="health-text">It’s quick and free.</p>
		</header>

		<form class="controls-col auth-col" on:submit|preventDefault={handleRegister}>
			<div class="auth-fields">
				<label class="input-wrap">
					<span class="input-label">Username</span>
					<input
						class="input-field"
						bind:value={usernameInputValue}
						placeholder="Nickname"
						autocomplete="username"
					/>
				</label>

				<label class="input-wrap">
					<span class="input-label">Password</span>
					<input
						class="input-field"
						type="password"
						bind:value={passwordInputValue}
						placeholder="••••••••"
						autocomplete="new-password"
					/>
				</label>

				<label class="input-wrap">
					<span class="input-label">Confirm password</span>
					<input
						class="input-field"
						type="password"
						bind:value={confirmPasswordInputValue}
						placeholder="••••••••"
						autocomplete="new-password"
					/>
				</label>
			</div>

			<div class="auth-actions stacked">
				<button class="button button-accent" type="submit">Create account</button>
				<button class="button button-ghost" type="button" on:click={() => goto('/')}>← Back</button>
			</div>
		</form>

		{#if registrationErrorMessage}
			<p class="empty-text" style="color:#ffbdbd">{registrationErrorMessage}</p>
		{/if}
	</section>
</div>
