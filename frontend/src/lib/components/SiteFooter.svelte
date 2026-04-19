<script lang="ts">
	import { SOCIAL_LINKS } from '$lib/config/siteMetadata';
	const currentYear = new Date().getFullYear();
</script>

<footer class="site-footer" aria-label="Kairos site footer">
	<div class="footer-inner footer-grid">
		<div class="footer-brand">
			<h2 class="footer-title">Kairos</h2>
			<p class="footer-tagline">Strategic mythology card battles in your browser.</p>
		</div>

		<nav class="footer-nav" aria-label="Community">
			<h3 class="footer-subtitle">Community</h3>
			<ul class="social-links">
				{#each SOCIAL_LINKS as link}
					<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
				{/each}
			</ul>
		</nav>
	</div>

	<div class="footer-legal">
		<p class="legal-text">© {currentYear} Kairos</p>
		<ul class="legal-links">
			<li><a href="/privacy">Privacy</a></li>
			<li><a href="/terms">Terms</a></li>
		</ul>
	</div>
</footer>
