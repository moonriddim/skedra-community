import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Editable source scene for the landing-page screenshot. Import into a separate
// guest canvas, fit the board to the viewport, then capture the actual editor.
const elements = [];
function element(type, x, y, width, height, extra = {}) {
	const value = {
		id: `studio-${elements.length + 1}`,
		type,
		x,
		y,
		width,
		height,
		rotation: 0,
		fill: "transparent",
		stroke: "#284f48",
		strokeWidth: 1.5,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		roughness: 0,
		...extra,
	};
	elements.push(value);
	return value;
}
function text(x, y, width, value, size = 18, color = "#284f48", bold = false) {
	return element(
		"text",
		x,
		y,
		width,
		Math.max(90, size * 1.5 * value.split("\n").length),
		{
			text: value,
			fontSize: size,
			fontFamily: "Outfit",
			textColor: color,
			stroke: color,
			strokeWidth: 0,
			fontWeight: bold ? "bold" : "normal",
			textAlign: "left",
			lineHeight: 1.4,
		},
	);
}
function card(x, y, w, h, color, label, sub) {
	element("rectangle", x, y, w, h, {
		fill: color,
		stroke: "transparent",
		cornerRadius: 12,
	});
	text(x + 16, y + 20, w - 32, label, 17, "#284f48", true);
	if (sub) text(x + 16, y + 58, w - 32, sub, 14);
}
function arrow(x, y, w, h = 0) {
	element("arrow", x, y, w, Math.abs(h), {
		points: [
			[0, 0],
			[w, h],
		],
		arrowHeadEnd: "arrow",
		stroke: "#4e8070",
		strokeWidth: 2,
	});
}
text(80, 65, 900, "Eine gute Idee. Ein gemeinsamer Plan.", 38, "#193c39", true);
text(
	80,
	120,
	850,
	"STUDIO NORD  /  WEBSITE-RELAUNCH  /  VOM GEDANKEN ZUM MACHEN",
	12,
	"#6b7d72",
);
element("line", 80, 166, 1190, 0, {
	points: [
		[0, 0],
		[1190, 0],
	],
	stroke: "#d1d9c9",
	strokeWidth: 1,
});
text(80, 194, 300, "01   IDEEN SAMMELN", 13, "#64796c", true);
text(495, 194, 380, "02   ZUSAMMENHÄNGE SEHEN", 13, "#64796c", true);
text(990, 194, 270, "03   INS MACHEN KOMMEN", 13, "#64796c", true);
card(
	80,
	240,
	175,
	155,
	"#f5d991",
	"Mehr zeigen.",
	"Weniger erklären.\nDas Produkt erleben.",
);
card(
	275,
	257,
	170,
	155,
	"#eac3b5",
	"Eigenständig.",
	"Klarer Charakter.\nMut zur Farbe.",
);
card(
	100,
	420,
	175,
	160,
	"#ccdec2",
	"Einfach starten.",
	"Kein Konto.\nDirekt zur Idee.",
);
card(
	295,
	448,
	150,
	144,
	"#dfd3ec",
	"Für alle.",
	"Desktop, Tablet\nund unterwegs.",
);
element("rectangle", 510, 254, 410, 312, {
	fill: "#edf0e6",
	stroke: "#d2dccf",
	cornerRadius: 16,
});
card(625, 281, 180, 78, "#234f44", "Entdecken");
// Light text for the dark start node.
elements[elements.length - 1].textColor = "#ffffff";
elements[elements.length - 1].stroke = "#ffffff";
arrow(715, 361, 0, 36);
card(625, 402, 180, 78, "#c6dcc2", "Ausprobieren");
arrow(624, 441, -56);
arrow(806, 441, 56);
text(529, 492, 150, "Ideen festhalten", 13);
text(765, 492, 150, "Weiterentwickeln", 13);
text(550, 601, 420, "Kleine Schritte. Große Möglichkeiten.", 22, "#537a62");
card(
	990,
	240,
	280,
	110,
	"#e4ebdc",
	"Die Richtung steht",
	"Positionierung & erste Skizzen",
);
card(
	990,
	368,
	280,
	110,
	"#f5d991",
	"Jetzt: Prototyp bauen",
	"Startseite & Whiteboard-Einstieg",
);
card(
	990,
	496,
	280,
	110,
	"#eeded3",
	"Danach: gemeinsam testen",
	"Feedback sammeln & verfeinern",
);
text(80, 660, 850, "PLATZ FÜR DEN NÄCHSTEN GEDANKEN.", 11, "#7b897c");
const out = resolve("apps/web/public/examples");
mkdirSync(out, { recursive: true });
writeFileSync(
	resolve(out, "idea-to-launch.skedra"),
	JSON.stringify(
		{
			type: "skedra",
			version: 1,
			source: "Skedra Studio",
			elements,
			views: [],
			appState: { canvasBg: "#fafbf5", viewport: { x: 30, y: 60, zoom: 1 } },
		},
		null,
		2,
	),
);
console.log(`Wrote ${elements.length} editable elements.`);
