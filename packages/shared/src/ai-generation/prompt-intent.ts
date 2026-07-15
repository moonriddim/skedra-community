/**
 * Prompt-Intent-Erkennung fuer Skedra-Canvas-Tools.
 */

import type { AiResultKind } from "./types";

/** Nutzer will mehrere / alle Tools auf einmal (Integrations-Demo). */
export function detectMultiToolShowcaseIntent(prompt: string): boolean {
	return /\b(von\s+jedem\s+tool|jedes\s+tool|alle\s+tools?|all\s+tools?|each\s+tool|jedes\s+werkzeug|alle\s+werkzeuge|integration\s+test(?:en)?|showcase|tool\s*[- ]?demo|demo\s+aller|alles\s+zeigen|verschiedene\s+tools?|mix\s+aus|tool\s+übersicht|tool\s+integration|von\s+allem\s+etwas|alles\s+auf\s+dem\s+board)\b/i.test(
		prompt,
	);
}

export const AI_SHOWCASE_APPENDIX = `
SHOWCASE-MODUS (Pflicht wenn der Nutzer mehrere oder alle Tools will):
Antworte mit EINEM JSON-Objekt mit einem "showcase"-Feld.
Das showcase-Objekt MUSS ALLE folgenden Bereiche enthalten — jeweils mit eigenen, sinnvollen Dummy-Daten zum Nutzer-Thema:
- kanban (lists + cards)
- mindmap (root + branches)
- flowchart (nodes + edges)
- stickyNotes (notes)
- retrospective (celebrate, friction, commitment)
- swot (strengths, weaknesses, opportunities, threats)
- frames (frames)
- diagram (elements — kleines Formen-Diagramm mit rectangle/arrow/diamond/ellipse)

Beispiel-Struktur:
{ "showcase": { "kanban": { ... }, "mindmap": { ... }, "flowchart": { ... }, "stickyNotes": { ... }, "retrospective": { ... }, "swot": { ... }, "frames": { ... }, "diagram": { "elements": [ ... ] } } }

VERBOTEN im Showcase-Modus: Nur ein einzelnes Kanban oder nur ein Tool liefern.`;

const INTENT_RULES: Array<{ kind: AiResultKind; pattern: RegExp }> = [
	{
		kind: "kanban",
		pattern:
			/\b(kanban|task\s*board|taskboard|backlog|sprint\s*board|todo\s*board)\b/i,
	},
	{
		kind: "mindmap",
		pattern: /\b(mind\s*map|mindmap|gedankenkarte|brainstorm)\b/i,
	},
	{
		kind: "flowchart",
		pattern:
			/\b(flow\s*chart|flowchart|prozess(?:diagramm|kette)?|ablaufdiagramm)\b/i,
	},
	{
		kind: "retrospective",
		pattern:
			/\b(retrospektive|retrospective|mad\s*sad\s*glad|sprint\s*retro)\b/i,
	},
	{
		kind: "swot",
		pattern: /\b(swot|st[aä]rken|schw[aä]chen|chancen|risken|threats)\b/i,
	},
	{
		kind: "stickyNotes",
		pattern: /\b(sticky\s*notes?|haftnotizen|post[\s-]?its?|notizzettel)\b/i,
	},
	{ kind: "frames", pattern: /\b(rahmen|frames?|bereiche?\s*markieren)\b/i },
];

export function detectPromptIntent(prompt: string): AiResultKind | null {
	for (const rule of INTENT_RULES) {
		if (rule.pattern.test(prompt)) return rule.kind;
	}
	return null;
}

export function enrichPromptWithIntent(prompt: string): string {
	if (detectMultiToolShowcaseIntent(prompt)) {
		return `${prompt}\n\n[Skedra: Showcase-Modus — erstelle ALLE Tools (kanban, mindmap, flowchart, stickyNotes, retrospective, swot, frames, diagram) im showcase-JSON.]`;
	}

	const intent = detectPromptIntent(prompt);
	if (!intent) return prompt;

	const hints: Record<AiResultKind, string> = {
		kanban: "Nutze das kanban-JSON-Format mit lists und cards.",
		mindmap: "Nutze das mindmap-JSON-Format mit root und branches.",
		flowchart:
			"Nutze das flowchart-JSON-Format mit nodes und edges (kind: start|step|decision|end).",
		stickyNotes: "Nutze das stickyNotes-JSON-Format mit notes-Array.",
		retrospective:
			"Nutze das retrospective-JSON-Format (celebrate, friction, commitment).",
		swot: "Nutze das swot-JSON-Format (strengths, weaknesses, opportunities, threats).",
		frames: "Nutze das frames-JSON-Format mit frames-Array.",
		diagram: "Nutze das elements-JSON-Format fuer Formen und Pfeile.",
		showcase: "Nutze das showcase-JSON mit allen Tool-Bereichen.",
	};

	return `${prompt}\n\n[Skedra: ${hints[intent]}]`;
}

export const AI_SYSTEM_PROMPT = `Du erzeugst Inhalte fuer Skedra-Whiteboards als JSON.
Antworte NUR mit EINEM JSON-Objekt — waehle genau EIN passendes Top-Level-Feld:

1) kanban — Taskboards mit Spalten und Karten:
{ "kanban": { "lists": [{ "name": "To Do", "cards": [{ "title": "...", "description": "...", "priority": "high", "checklist": [{ "text": "..." }] }] }] } }

2) mindmap — Mindmap mit Wurzel und Aesten:
{ "mindmap": { "root": "Thema", "branches": [{ "title": "Ast", "direction": "right", "children": [{ "title": "Unterpunkt" }] }] } }

3) flowchart — Prozessdiagramm (echtes Flowchart-Tool, keine rohen Rechtecke):
{ "flowchart": { "nodes": [{ "id": "start", "kind": "start", "text": "Start" }, { "id": "d1", "kind": "decision", "text": "OK?" }], "edges": [{ "from": "start", "to": "d1" }, { "from": "d1", "to": "fix", "branch": "no", "label": "Nein" }] } }
- kind: start | step | decision | end
- branch optional: next | yes | no, route optional: right | down | left-up

4) stickyNotes — Haftnotizen:
{ "stickyNotes": { "notes": [{ "text": "Idee", "color": "#FFF3BF" }] } }

5) retrospective — Retro-Board (3 Spalten):
{ "retrospective": { "celebrate": ["..."], "friction": ["..."], "commitment": ["..."] } }

6) swot — SWOT-Analyse (4 Felder):
{ "swot": { "strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."] } }

7) frames — Beschriftete Rahmen:
{ "frames": { "frames": [{ "label": "Bereich A", "width": 420, "height": 280 }] } }

8) elements — Freies Diagramm (Formen, Pfeile, Text):
{ "elements": [{ "type": "rectangle", "x": 80, "y": 80, "width": 160, "height": 64, "text": "Schritt" }] }
- type: rectangle | ellipse | diamond | triangle | cloud | line | arrow | text
- Max 40 Elemente, Start ca. x=80,y=80

WICHTIG:
- Kanban/Mindmap/Flowchart/Retro/SWOT/StickyNotes NIEMALS mit einfachen Rechtecken simulieren.
- Waehle das spezialisierte Format passend zur Nutzer-Anfrage.
- Fuelle Dummy-Daten sinnvoll, wenn der Nutzer danach fragt.`;
