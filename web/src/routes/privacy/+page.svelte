<script lang="ts">
	import { SOCIAL_LINKS } from '$lib/config/siteMetadata';
	import '$lib/styles/routes/legalPage.css';

	const lastUpdated = 'June 6, 2026';
	const githubUrl =
		SOCIAL_LINKS.find((link) => link.label === 'GitHub')?.url ??
		'https://github.com/bobagi/chronos';
</script>

<svelte:head>
	<meta
		name="description"
		content="How the Chronos card game collects, uses and protects your information."
	/>
</svelte:head>

<div class="legal-page">
	<a class="legal-back" href="/">← Back to Chronos</a>
	<p class="legal-kicker">Legal</p>
	<h1>Privacy Policy</h1>
	<p class="legal-updated">Last updated: {lastUpdated}</p>

	<div class="legal-card">
		<p>
			Chronos is a free, non-commercial portfolio project — a digital collectible card game built to
			showcase the Dracomania collection. This page explains, in plain language, what information
			the game handles and why. We collect as little as possible and never sell your data.
		</p>

		<h2>Information we collect</h2>
		<ul>
			<li>
				<strong>Account details</strong> — the username you choose and your password. Passwords are stored
				only as a salted hash; we never keep or display the plain text.
			</li>
			<li>
				<strong>Gameplay data</strong> — the matches you play, their results, and aggregate statistics
				such as games played, won and drawn, so your dashboard can show your progress.
			</li>
			<li>
				<strong>Social data</strong> — friend requests, your friends list and any chat messages you send
				through the in-game friends panel.
			</li>
			<li>
				<strong>Technical data</strong> — a single session cookie that keeps you signed in. We do not
				use advertising or cross-site tracking cookies.
			</li>
		</ul>

		<h2>How we use your information</h2>
		<ul>
			<li>To create your account and keep you signed in.</li>
			<li>To run matches, match you with friends and record results and statistics.</li>
			<li>To keep the service working, secure and free of abuse.</li>
		</ul>

		<h2>Cookies</h2>
		<p>
			Chronos uses one essential, first-party session cookie to remember that you are logged in. It
			is required for the game to function and is removed when you log out. No third-party analytics
			or advertising cookies are set.
		</p>

		<h2>Sharing &amp; third parties</h2>
		<p>
			We do not sell, rent or trade your personal information. Card artwork is served from
			<code>bobagi.space</code>; loading those images involves a standard web request to that host.
			The game is hosted on the owner's own infrastructure.
		</p>

		<h2>Data retention</h2>
		<p>
			Inactive games are expired and cleaned up automatically. Account and gameplay data are kept
			while your account exists. You may request deletion of your account and associated data at any
			time using the contact below.
		</p>

		<h2>Your rights</h2>
		<p>
			You can ask to access, correct or delete the information associated with your account. Because
			this is a small hobby project, requests are handled manually on a best-effort basis.
		</p>

		<h2>Children</h2>
		<p>
			Chronos is not directed at children under 13, and we do not knowingly collect information from
			them.
		</p>

		<h2>Changes to this policy</h2>
		<p>
			We may update this policy as the project evolves. Material changes will be reflected by the
			"last updated" date above.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about privacy? Reach out through the project's
			<a href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub repository</a>.
		</p>

		<p class="legal-note">
			Chronos is a personal portfolio project, not a commercial service. This document is provided
			for transparency and does not constitute legal advice.
		</p>
	</div>
</div>
