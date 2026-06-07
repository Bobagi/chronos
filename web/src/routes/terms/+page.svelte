<script lang="ts">
	import { SOCIAL_LINKS } from '$lib/config/siteMetadata';
	import '$lib/styles/routes/legalPage.css';

	const lastUpdated = 'June 6, 2026';
	const githubUrl =
		SOCIAL_LINKS.find((link) => link.label === 'GitHub')?.url ??
		'https://github.com/bobagi/chronos';
</script>

<svelte:head>
	<meta name="description" content="The terms for playing the Chronos digital card game." />
</svelte:head>

<div class="legal-page">
	<a class="legal-back" href="/">← Back to Chronos</a>
	<p class="legal-kicker">Legal</p>
	<h1>Terms of Service</h1>
	<p class="legal-updated">Last updated: {lastUpdated}</p>

	<div class="legal-card">
		<p>
			Welcome to Chronos, a free digital collectible card game and personal portfolio project. By
			creating an account or playing, you agree to these terms. If you do not agree, please don't
			use the service.
		</p>

		<h2>The service</h2>
		<p>
			Chronos is provided free of charge, "as is", for entertainment and demonstration purposes. It
			is an evolving hobby project: features may change, and the game may be unavailable or
			discontinued at any time without notice.
		</p>

		<h2>Your account</h2>
		<ul>
			<li>You are responsible for keeping your password and account secure.</li>
			<li>Provide accurate information and do not impersonate others.</li>
			<li>You are responsible for activity that happens under your account.</li>
		</ul>

		<h2>Acceptable use</h2>
		<p>You agree not to:</p>
		<ul>
			<li>Cheat, exploit bugs, or use bots or automated scripts to play or scrape the game.</li>
			<li>Harass, threaten or abuse other players through chat or any other feature.</li>
			<li>
				Attempt to disrupt, overload, reverse-engineer for malicious purposes, or gain unauthorized
				access to the service or other accounts.
			</li>
			<li>Use the service for anything unlawful.</li>
		</ul>

		<h2>Intellectual property</h2>
		<p>
			The Chronos name, the Dracomania collection and its card artwork belong to their owner. Fonts
			and other third-party assets remain the property of their respective owners. The project's
			source code is governed by the license in its
			<a href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub repository</a>. You
			receive a personal, non-exclusive, non-transferable right to play the game; nothing here
			transfers ownership of any content to you.
		</p>

		<h2>Disclaimer of warranties</h2>
		<p>
			The service is provided without warranties of any kind, express or implied, including fitness
			for a particular purpose and uninterrupted or error-free operation. You use it at your own
			risk.
		</p>

		<h2>Limitation of liability</h2>
		<p>
			To the maximum extent permitted by law, the project and its owner are not liable for any
			indirect, incidental or consequential damages, or for any loss of data, arising from your use
			of the service.
		</p>

		<h2>Termination</h2>
		<p>
			You may stop using Chronos and request account deletion at any time. We may suspend or remove
			accounts that violate these terms or to protect the service and its players.
		</p>

		<h2>Changes to these terms</h2>
		<p>
			We may update these terms as the project changes. Continued use after an update means you
			accept the revised terms; the "last updated" date above reflects the latest version.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about these terms? Reach out through the project's
			<a href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub repository</a>.
		</p>

		<p class="legal-note">
			Chronos is a personal portfolio project, not a commercial service. These terms are provided
			for transparency and do not constitute legal advice.
		</p>
	</div>
</div>
