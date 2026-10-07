import { useLayoutEffect, useRef } from "react";

/** Reserve the space actually occupied by chrome, including wrapped translations. */
export function useCanvasChromeInset(edge: "top" | "presenter", active = true) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		const canvas = element?.closest<HTMLElement>(".canvas-editor");
		if (!active || !element || !canvas) return;
		const property = `--skedra-canvas-${edge}-inset`;
		const measure = () => {
			const rect = element.getBoundingClientRect();
			const boundary = canvas.getBoundingClientRect();
			const inset =
				edge === "top"
					? rect.bottom - boundary.top + 12
					: boundary.bottom - rect.top + 12;
			canvas.style.setProperty(property, `${Math.ceil(inset)}px`);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		observer.observe(canvas);
		const page = canvas.closest<HTMLElement>(".skedra-canvas-page");
		const positionObserver = new MutationObserver(measure);
		// Board action rows can wrap without changing this dock's own size.
		if (page && page !== canvas)
			positionObserver.observe(page, {
				attributes: true,
				attributeFilter: ["style"],
			});
		positionObserver.observe(element, {
			attributes: true,
			attributeFilter: ["style"],
		});
		measure();
		return () => {
			observer.disconnect();
			positionObserver.disconnect();
			canvas.style.removeProperty(property);
		};
	}, [edge, active]);
	return ref;
}
