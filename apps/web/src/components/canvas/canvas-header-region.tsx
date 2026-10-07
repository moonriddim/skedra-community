import { type HTMLAttributes, useLayoutEffect, useRef } from "react";

/** Reserve room for board navigation and actions beside the shared toolbar. */
export function CanvasHeaderRegion({
	region,
	...props
}: HTMLAttributes<HTMLDivElement> & { region: "navigation" | "actions" }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		const page = element?.closest<HTMLElement>(".skedra-canvas-page");
		if (!element || !page) return;
		const measure = () => {
			const boundary = page.getBoundingClientRect();
			page.style.setProperty(
				`--skedra-board-${region}-width`,
				`${Math.ceil(element.getBoundingClientRect().width)}px`,
			);
			const regions = page.querySelectorAll<HTMLElement>(
				"[data-skedra-header-region]",
			);
			const bottom = Math.max(
				...Array.from(
					regions,
					(item) => item.getBoundingClientRect().bottom - boundary.top,
				),
			);
			page.style.setProperty(
				"--skedra-board-header-inset",
				`${Math.ceil(bottom + 12)}px`,
			);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		observer.observe(page);
		measure();
		return () => {
			observer.disconnect();
			page.style.removeProperty(`--skedra-board-${region}-width`);
		};
	}, [region]);
	return <div {...props} ref={ref} data-skedra-header-region={region} />;
}
