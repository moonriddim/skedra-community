import { useEffect } from "react";

/** Private installations must not advertise boards or a centrally hosted service. */
export function SeoManager() {
	useEffect(() => {
		document.title = "Skedra Whiteboard";
		let robots = document.querySelector('meta[name="robots"]');
		if (!robots) {
			robots = document.createElement("meta");
			robots.setAttribute("name", "robots");
			document.head.append(robots);
		}
		robots.setAttribute("content", "noindex, nofollow");
	}, []);
	return null;
}
