export function clonePresentationPreviewSvg(svg: SVGSVGElement) {
	const theme = getComputedStyle(svg);
	const snapshot = svg.cloneNode(true) as SVGSVGElement;
	// Standalone SVGs cannot inherit the app's Kanban, Gantt or theme tokens.
	// Freeze them on the clone so theme switches still reach the live renderer.
	for (const key of Array.from(theme)) {
		if (key.startsWith("--"))
			snapshot.style.setProperty(key, theme.getPropertyValue(key));
	}
	return snapshot;
}
