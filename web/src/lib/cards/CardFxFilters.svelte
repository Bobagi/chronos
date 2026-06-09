<!--
  The two SVG filters the destruction effects drive (ported from the handoff):
  - #fx-destroy : turbulence mixed with a progress map + animated threshold →
    card eaten away, with a charred sliver behind a bright emissive front (burn/dissolve).
  - #fx-crush   : a procedural radial displacement dent.
  Render this ONCE near the app root; CardDestroyer mutates these elements by id.
  Only one card destructs at a time, so a single shared filter set is enough.
-->
<svg width="0" height="0" style="position: absolute" aria-hidden="true">
	<filter
		id="fx-destroy"
		x="-30%"
		y="-30%"
		width="160%"
		height="160%"
		color-interpolation-filters="sRGB"
	>
		<feTurbulence
			id="fx-noise"
			type="fractalNoise"
			baseFrequency="0.05"
			numOctaves="3"
			seed="1"
			stitchTiles="stitch"
			result="n"
		/>
		<feColorMatrix
			in="n"
			type="matrix"
			result="nF"
			values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1"
		/>
		<feImage
			id="fx-map"
			href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23808080'/%3E%3C/svg%3E"
			x="0"
			y="0"
			width="320"
			height="448"
			preserveAspectRatio="none"
			result="pmap"
		/>
		<feComposite
			id="fx-mix"
			in="nF"
			in2="pmap"
			operator="arithmetic"
			k1="0"
			k2="1"
			k3="0"
			k4="0"
			result="mix"
		/>
		<feColorMatrix
			id="fx-m0"
			in="mix"
			type="matrix"
			result="m0"
			values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  60 0 0 0 1"
		/>
		<feColorMatrix
			id="fx-m1"
			in="mix"
			type="matrix"
			result="m1"
			values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  60 0 0 0 0.9"
		/>
		<feColorMatrix
			id="fx-m2"
			in="mix"
			type="matrix"
			result="m2"
			values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  60 0 0 0 0.8"
		/>
		<feComposite in="SourceGraphic" in2="m0" operator="in" result="cardbody" />
		<feComposite in="m0" in2="m1" operator="out" result="ringChar" />
		<feComposite in="m1" in2="m2" operator="out" result="ringHot" />
		<feFlood id="fx-char" flood-color="#160d08" flood-opacity="0.85" result="charF" />
		<feComposite in="charF" in2="ringChar" operator="in" result="charEdge0" />
		<feFlood id="fx-hot" flood-color="#ffd27a" flood-opacity="1" result="hotF" />
		<feComposite in="hotF" in2="ringHot" operator="in" result="hotEdge0" />
		<feComposite in="charEdge0" in2="SourceGraphic" operator="in" result="charEdge" />
		<feComposite in="hotEdge0" in2="SourceGraphic" operator="in" result="hotEdge" />
		<feGaussianBlur id="fx-blur" in="hotEdge" stdDeviation="2.5" result="hotGlow" />
		<feMerge>
			<feMergeNode in="cardbody" />
			<feMergeNode in="charEdge" />
			<feMergeNode in="hotEdge" />
			<feMergeNode in="hotGlow" />
		</feMerge>
	</filter>
	<filter
		id="fx-crush"
		x="-35%"
		y="-35%"
		width="170%"
		height="170%"
		color-interpolation-filters="sRGB"
	>
		<feImage
			id="fx-cmap"
			href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23808080'/%3E%3C/svg%3E"
			x="0"
			y="0"
			width="320"
			height="448"
			preserveAspectRatio="none"
			result="cmap"
		/>
		<feDisplacementMap
			id="fx-disp"
			in="SourceGraphic"
			in2="cmap"
			scale="0"
			xChannelSelector="R"
			yChannelSelector="G"
		/>
	</filter>
</svg>
