import type { CanvasMutationPlan } from "./editor-operations";
import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "./element-factory";
import { createStackIndexBefore } from "./ordering";
import type { CanvasElement } from "./types";

export const SEQUENCE_DIAGRAM_ELEMENT_TYPE = "sequence-diagram-element";

export const DEFAULT_SEQUENCE_DIAGRAM_SOURCE = `sequenceDiagram
    title Sign-in flow
    actor User
    participant Web as Web App
    participant API
    participant DB as Database
    User->>Web: Enter email and password
    activate Web
    Web->>API: POST /sessions
    activate API
    API->>DB: Find user
    DB-->>API: User record
    alt Credentials are valid
        API-->>Web: Session token
        Web-->>User: Open dashboard
    else Credentials are invalid
        API-->>Web: 401 Unauthorized
        Web-->>User: Show error
    end
    deactivate API
    deactivate Web`;

export type SequenceParticipantKind =
	| "participant"
	| "actor"
	| "boundary"
	| "control"
	| "entity"
	| "database"
	| "collections"
	| "queue";

export type SequenceMessageArrow =
	| "->"
	| "-->"
	| "->>"
	| "-->>"
	| "<<->>"
	| "<<-->>"
	| "-x"
	| "--x"
	| "-)"
	| "--)";

export type SequenceBlockKind =
	| "loop"
	| "alt"
	| "opt"
	| "par"
	| "critical"
	| "break"
	| "rect";

export interface SequenceParticipant {
	id: string;
	label: string;
	kind: SequenceParticipantKind;
	line: number;
}

export interface SequenceMessageEvent {
	type: "message";
	from: string;
	to: string;
	text: string;
	arrow: SequenceMessageArrow;
	activation: "+" | "-" | null;
	line: number;
}

export interface SequenceActivationEvent {
	type: "activation";
	action: "activate" | "deactivate";
	participantId: string;
	line: number;
}

export interface SequenceNoteEvent {
	type: "note";
	placement: "left" | "right" | "over";
	participantIds: string[];
	text: string;
	line: number;
}

export interface SequenceBlockStartEvent {
	type: "block-start";
	kind: SequenceBlockKind;
	label: string;
	color?: string;
	line: number;
}

export interface SequenceBlockDividerEvent {
	type: "block-divider";
	kind: "else" | "and" | "option";
	label: string;
	line: number;
}

export interface SequenceBlockEndEvent {
	type: "block-end";
	line: number;
}

export interface SequenceLifecycleEvent {
	type: "lifecycle";
	action: "create" | "destroy";
	participantId: string;
	line: number;
}

export type SequenceDiagramEvent =
	| SequenceMessageEvent
	| SequenceActivationEvent
	| SequenceNoteEvent
	| SequenceBlockStartEvent
	| SequenceBlockDividerEvent
	| SequenceBlockEndEvent
	| SequenceLifecycleEvent;

export interface SequenceDiagramDocument {
	title: string | null;
	autonumber: { start: number; increment: number } | null;
	participants: SequenceParticipant[];
	events: SequenceDiagramEvent[];
}

export interface SequenceDiagramDiagnostic {
	severity: "error" | "warning";
	line: number;
	column: number;
	code: string;
	message: string;
}

export interface SequenceDiagramParseResult {
	document: SequenceDiagramDocument;
	diagnostics: SequenceDiagramDiagnostic[];
}

export type SequenceDiagramElementRole =
	| "title"
	| "participant"
	| "actor"
	| "lifeline"
	| "message"
	| "message-label"
	| "activation"
	| "note"
	| "fragment"
	| "fragment-label"
	| "fragment-divider"
	| "destroy";

export interface SequenceDiagramElementMeta extends Record<string, unknown> {
	skedraType: typeof SEQUENCE_DIAGRAM_ELEMENT_TYPE;
	sequenceDiagramId: string;
	sequenceRole: SequenceDiagramElementRole;
	sequenceParticipantId?: string;
	sequenceSourceId?: string;
	sequenceTargetId?: string;
	sequenceEventIndex?: number;
	sequenceMessageKind?: SequenceVisualMessageKind;
	sequenceFragmentKind?: SequenceVisualFragmentKind;
}

export type SequenceVisualPreset = "blank" | "checkout";

export type SequenceVisualMessageKind =
	| "synchronous"
	| "asynchronous"
	| "return"
	| "self";

export type SequenceVisualFragmentKind = "alt" | "opt" | "loop";

export interface SequenceDiagramParticipantSummary {
	id: string;
	label: string;
	kind: "actor" | "participant";
	x: number;
	headerTop: number;
	headerBottom: number;
	lifelineElementId: string;
}

export interface SequenceDiagramMessageSummary {
	eventIndex: number;
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
	y: number;
	messageElementId: string;
	labelElementId: string | null;
}

export interface SequenceDiagramSummary {
	id: string;
	title: string | null;
	participants: SequenceDiagramParticipantSummary[];
	messages: SequenceDiagramMessageSummary[];
	bounds: { x: number; y: number; width: number; height: number };
	eventTop: number;
	nextEventY: number;
	lifelineBottom: number;
}

export interface CreateVisualSequenceDiagramOptions {
	preset: SequenceVisualPreset;
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	appearance?: SequenceDiagramAppearance;
	diagramId?: string;
}

interface SequenceDiagramMutationBaseOptions {
	elements: ReadonlyMap<string, CanvasElement>;
	diagramId: string;
	defaults: CanvasElementFactoryDefaults;
	appearance?: SequenceDiagramAppearance;
}

export interface AddSequenceDiagramParticipantOptions
	extends SequenceDiagramMutationBaseOptions {
	label: string;
	kind: "actor" | "participant";
	participantGap?: number;
}

export interface AddSequenceDiagramMessageOptions
	extends SequenceDiagramMutationBaseOptions {
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
}

export interface UpdateSequenceDiagramMessageOptions
	extends AddSequenceDiagramMessageOptions {
	eventIndex: number;
}

export interface DeleteSequenceDiagramMessageOptions
	extends SequenceDiagramMutationBaseOptions {
	eventIndex: number;
}

export interface AddSequenceDiagramActivationOptions
	extends SequenceDiagramMutationBaseOptions {
	participantId: string;
	height?: number;
}

export interface AddSequenceDiagramFragmentOptions
	extends SequenceDiagramMutationBaseOptions {
	kind: SequenceVisualFragmentKind;
	label: string;
	wrapCurrentFlow?: boolean;
}

/** Transport-neutral actions used by the editor, AI and MCP integrations. */
export type SequenceDiagramEditAction =
	| {
			operation: "add_participant";
			label: string;
			kind: "actor" | "participant";
	  }
	| {
			operation: "add_message";
			fromParticipantId: string;
			toParticipantId: string;
			label: string;
			kind: SequenceVisualMessageKind;
	  }
	| {
			operation: "update_message";
			eventIndex: number;
			fromParticipantId: string;
			toParticipantId: string;
			label: string;
			kind: SequenceVisualMessageKind;
	  }
	| {
			operation: "delete_message";
			eventIndex: number;
	  }
	| {
			operation: "add_activation";
			participantId: string;
			height?: number;
	  }
	| {
			operation: "add_fragment";
			kind: SequenceVisualFragmentKind;
			label: string;
			wrapCurrentFlow?: boolean;
	  };

export interface PlanSequenceDiagramEditOptions
	extends SequenceDiagramMutationBaseOptions {
	action: SequenceDiagramEditAction;
}

export interface SequenceDiagramAppearance {
	stroke?: string;
	textColor?: string;
	participantFill?: string;
	participantStroke?: string;
	lifelineStroke?: string;
	messageStroke?: string;
	activationFill?: string;
	noteFill?: string;
	noteStroke?: string;
	noteTextColor?: string;
	fragmentStroke?: string;
	fragmentFill?: string;
	fontFamily?: string;
}

export interface CreateSequenceDiagramElementsOptions {
	source: string;
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	appearance?: SequenceDiagramAppearance;
	participantGap?: number;
	minEventAreaHeight?: number;
	diagramId?: string;
}

export interface TryCreateSequenceDiagramElementsResult
	extends SequenceDiagramParseResult {
	elements: CanvasElement[];
}

const PARTICIPANT_ID_PATTERN = "[A-Za-z0-9_.-]+";
const MESSAGE_ARROW_PATTERN = "<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\\)|-\\)";
const PARTICIPANT_KINDS = new Set<SequenceParticipantKind>([
	"participant",
	"actor",
	"boundary",
	"control",
	"entity",
	"database",
	"collections",
	"queue",
]);

function decodeSequenceText(value: string): string {
	return value
		.replace(/<br\s*\/?\s*>/giu, "\n")
		.replace(/#(\d+);/gu, (_match, code: string) =>
			String.fromCodePoint(Number(code)),
		)
		.replace(/&lt;/giu, "<")
		.replace(/&gt;/giu, ">")
		.replace(/&amp;/giu, "&")
		.trim();
}

function stripSourceEnvelope(source: string): string[] {
	const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
	const lines = normalized.split("\n");
	if (lines[0]?.trim().startsWith("```")) lines.shift();
	if (lines.at(-1)?.trim().startsWith("```")) lines.pop();
	return lines;
}

function parseParticipantDeclaration(
	line: string,
): { id: string; label: string; kind: SequenceParticipantKind } | null {
	const match = line.match(
		new RegExp(
			`^(participant|actor)\\s+(${PARTICIPANT_ID_PATTERN})(?:@\\{([\\s\\S]*?)\\})?(?:\\s+as\\s+(.+))?$`,
			"iu",
		),
	);
	if (!match) return null;
	const [, declarationKind, id, rawConfiguration, externalAlias] = match;
	let kind: SequenceParticipantKind =
		declarationKind.toLowerCase() === "actor" ? "actor" : "participant";
	let inlineAlias: string | undefined;
	if (rawConfiguration) {
		try {
			const config = JSON.parse(`{${rawConfiguration}}`) as Record<
				string,
				unknown
			>;
			if (
				typeof config.type === "string" &&
				PARTICIPANT_KINDS.has(config.type as SequenceParticipantKind)
			) {
				kind = config.type as SequenceParticipantKind;
			}
			if (typeof config.alias === "string") inlineAlias = config.alias;
		} catch {
			// The parser reports the malformed configuration from the calling branch.
		}
	}
	return {
		id,
		label: decodeSequenceText(externalAlias ?? inlineAlias ?? id),
		kind,
	};
}

function isParticipantConfigurationMalformed(line: string): boolean {
	if (!/^\s*(participant|actor)\b/iu.test(line) || !line.includes("@{")) {
		return false;
	}
	const configuration = line.match(/@\{([\s\S]*?)\}/u)?.[1];
	if (configuration == null) return true;
	try {
		JSON.parse(`{${configuration}}`);
		return false;
	} catch {
		return true;
	}
}

export function parseSequenceDiagram(
	source: string,
): SequenceDiagramParseResult {
	const participants: SequenceParticipant[] = [];
	const participantById = new Map<string, SequenceParticipant>();
	const events: SequenceDiagramEvent[] = [];
	const diagnostics: SequenceDiagramDiagnostic[] = [];
	const blockStack: SequenceBlockKind[] = [];
	let title: string | null = null;
	let autonumber: SequenceDiagramDocument["autonumber"] = null;

	const addParticipant = (
		id: string,
		line: number,
		input: Partial<Pick<SequenceParticipant, "label" | "kind">> = {},
	) => {
		const existing = participantById.get(id);
		if (existing) {
			if (input.label) existing.label = input.label;
			if (input.kind) existing.kind = input.kind;
			return existing;
		}
		const participant: SequenceParticipant = {
			id,
			label: input.label ?? id,
			kind: input.kind ?? "participant",
			line,
		};
		participants.push(participant);
		participantById.set(id, participant);
		return participant;
	};

	const lines = stripSourceEnvelope(source);
	let sawHeader = false;
	for (let index = 0; index < lines.length; index++) {
		const lineNumber = index + 1;
		const line = lines[index].trim();
		if (!line || line.startsWith("%%")) continue;
		if (/^sequenceDiagram\s*$/iu.test(line)) {
			sawHeader = true;
			continue;
		}
		if (/^title\s+/iu.test(line)) {
			title = decodeSequenceText(line.replace(/^title\s+/iu, ""));
			continue;
		}
		const autonumberMatch = line.match(
			/^autonumber(?:\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?)?\s*$/iu,
		);
		if (autonumberMatch) {
			autonumber = {
				start: Number(autonumberMatch[1] ?? 1),
				increment: Number(autonumberMatch[2] ?? 1),
			};
			continue;
		}

		const participant = parseParticipantDeclaration(line);
		if (participant) {
			if (isParticipantConfigurationMalformed(line)) {
				diagnostics.push({
					severity: "error",
					line: lineNumber,
					column: line.indexOf("@{") + 1,
					code: "invalid-participant-config",
					message: "Participant configuration must contain valid JSON fields.",
				});
			}
			addParticipant(participant.id, lineNumber, participant);
			continue;
		}

		const lifecycleDeclaration = line.match(
			new RegExp(
				`^(create|destroy)\\s+(?:(participant|actor)\\s+)?(${PARTICIPANT_ID_PATTERN})(?:\\s+as\\s+(.+))?$`,
				"iu",
			),
		);
		if (lifecycleDeclaration) {
			const [, action, kind, id, alias] = lifecycleDeclaration;
			addParticipant(id, lineNumber, {
				label: alias ? decodeSequenceText(alias) : undefined,
				kind: kind?.toLowerCase() === "actor" ? "actor" : undefined,
			});
			events.push({
				type: "lifecycle",
				action: action.toLowerCase() as "create" | "destroy",
				participantId: id,
				line: lineNumber,
			});
			continue;
		}

		const activation = line.match(
			new RegExp(
				`^(activate|deactivate)\\s+(${PARTICIPANT_ID_PATTERN})$`,
				"iu",
			),
		);
		if (activation) {
			const [, action, participantId] = activation;
			addParticipant(participantId, lineNumber);
			events.push({
				type: "activation",
				action: action.toLowerCase() as "activate" | "deactivate",
				participantId,
				line: lineNumber,
			});
			continue;
		}

		const note = line.match(
			new RegExp(
				`^note\\s+(left|right)\\s+of\\s+(${PARTICIPANT_ID_PATTERN})\\s*:\\s*(.+)$|^note\\s+over\\s+(${PARTICIPANT_ID_PATTERN})(?:\\s*,\\s*(${PARTICIPANT_ID_PATTERN}))?\\s*:\\s*(.+)$`,
				"iu",
			),
		);
		if (note) {
			if (note[1]) {
				addParticipant(note[2], lineNumber);
				events.push({
					type: "note",
					placement: note[1].toLowerCase() as "left" | "right",
					participantIds: [note[2]],
					text: decodeSequenceText(note[3]),
					line: lineNumber,
				});
			} else {
				const ids = [note[4], note[5]].filter(
					(value): value is string => typeof value === "string",
				);
				for (const id of ids) addParticipant(id, lineNumber);
				events.push({
					type: "note",
					placement: "over",
					participantIds: ids,
					text: decodeSequenceText(note[6]),
					line: lineNumber,
				});
			}
			continue;
		}

		const message = line.match(
			new RegExp(
				`^([A-Za-z0-9_.-]+?)\\s*(${MESSAGE_ARROW_PATTERN})([+-]?)\\s*(${PARTICIPANT_ID_PATTERN})\\s*:\\s*(.*)$`,
				"u",
			),
		);
		if (message) {
			const [, from, arrow, activationMarker, to, text] = message;
			addParticipant(from, lineNumber);
			addParticipant(to, lineNumber);
			events.push({
				type: "message",
				from,
				to,
				text: decodeSequenceText(text),
				arrow: arrow as SequenceMessageArrow,
				activation:
					activationMarker === "+" || activationMarker === "-"
						? activationMarker
						: null,
				line: lineNumber,
			});
			continue;
		}

		const blockStart = line.match(
			/^(loop|alt|opt|par|critical|break)(?:\s+(.*))?$/iu,
		);
		if (blockStart) {
			const kind = blockStart[1].toLowerCase() as SequenceBlockKind;
			blockStack.push(kind);
			events.push({
				type: "block-start",
				kind,
				label: decodeSequenceText(blockStart[2] ?? ""),
				line: lineNumber,
			});
			continue;
		}

		const rectStart = line.match(/^rect(?:\s+(.+))?$/iu);
		if (rectStart) {
			blockStack.push("rect");
			events.push({
				type: "block-start",
				kind: "rect",
				label: "",
				color: rectStart[1]?.trim(),
				line: lineNumber,
			});
			continue;
		}

		const divider = line.match(/^(else|and|option)(?:\s+(.*))?$/iu);
		if (divider) {
			if (blockStack.length === 0) {
				diagnostics.push({
					severity: "error",
					line: lineNumber,
					column: 1,
					code: "orphan-divider",
					message: `${divider[1]} must be inside a sequence fragment.`,
				});
			}
			events.push({
				type: "block-divider",
				kind: divider[1].toLowerCase() as "else" | "and" | "option",
				label: decodeSequenceText(divider[2] ?? ""),
				line: lineNumber,
			});
			continue;
		}

		if (/^end\s*$/iu.test(line)) {
			if (blockStack.length === 0) {
				diagnostics.push({
					severity: "error",
					line: lineNumber,
					column: 1,
					code: "orphan-end",
					message: "end has no matching sequence fragment.",
				});
			} else {
				blockStack.pop();
			}
			events.push({ type: "block-end", line: lineNumber });
			continue;
		}

		diagnostics.push({
			severity: "error",
			line: lineNumber,
			column: 1,
			code: "unsupported-statement",
			message: `Unsupported sequence diagram statement: ${line}`,
		});
	}

	if (!sawHeader) {
		diagnostics.push({
			severity: "error",
			line: 1,
			column: 1,
			code: "missing-header",
			message: "Sequence diagram source must start with sequenceDiagram.",
		});
	}
	if (blockStack.length > 0) {
		diagnostics.push({
			severity: "error",
			line: lines.length,
			column: 1,
			code: "unclosed-fragment",
			message: `${blockStack.length} sequence fragment(s) are missing end.`,
		});
	}
	if (participants.length === 0) {
		diagnostics.push({
			severity: "error",
			line: 1,
			column: 1,
			code: "missing-participants",
			message: "Add at least one participant or message.",
		});
	}

	return {
		document: { title, autonumber, participants, events },
		diagnostics,
	};
}

export class SequenceDiagramParseError extends Error {
	readonly diagnostics: SequenceDiagramDiagnostic[];

	constructor(diagnostics: SequenceDiagramDiagnostic[]) {
		super(
			diagnostics.find((diagnostic) => diagnostic.severity === "error")
				?.message ?? "Invalid sequence diagram source.",
		);
		this.name = "SequenceDiagramParseError";
		this.diagnostics = diagnostics;
	}
}

function sequenceMeta(
	diagramId: string,
	role: SequenceDiagramElementRole,
	extra: Omit<
		SequenceDiagramElementMeta,
		"skedraType" | "sequenceDiagramId" | "sequenceRole"
	> = {},
): SequenceDiagramElementMeta {
	return {
		skedraType: SEQUENCE_DIAGRAM_ELEMENT_TYPE,
		sequenceDiagramId: diagramId,
		sequenceRole: role,
		...extra,
	};
}

function createLineElement(
	defaults: CanvasElementFactoryDefaults,
	points: [number, number][],
	overrides: Partial<CanvasElement> = {},
): CanvasElement {
	const minX = Math.min(...points.map(([x]) => x));
	const minY = Math.min(...points.map(([, y]) => y));
	const maxX = Math.max(...points.map(([x]) => x));
	const maxY = Math.max(...points.map(([, y]) => y));
	return createBaseCanvasElement(defaults, {
		type: "line",
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: points.map(([x, y]) => [x - minX, y - minY]),
		fill: "transparent",
		arrowMode: points.length > 2 ? "elbow" : "straight",
		...overrides,
	});
}

function getSequenceEventHeight(event: SequenceDiagramEvent): number {
	switch (event.type) {
		case "message":
			return event.from === event.to ? 88 : 64;
		case "note":
			return 86;
		case "block-start":
			return 42;
		case "block-divider":
			return 46;
		case "block-end":
			return 24;
		case "activation":
			return 12;
		case "lifecycle":
			return 22;
	}
}

function getEventAnchorY(
	event: SequenceDiagramEvent,
	position: { y: number; height: number },
): number {
	return event.type === "message"
		? position.y + (event.from === event.to ? 28 : 30)
		: position.y + position.height / 2;
}

function createTextElement(
	defaults: CanvasElementFactoryDefaults,
	input: {
		x: number;
		y: number;
		width: number;
		height: number;
		text: string;
		fontSize: number;
		fontFamily: string;
		textColor: string;
		textAlign?: "left" | "center" | "right";
		fontWeight?: "normal" | "bold";
		groupId?: string | null;
		customData: Record<string, unknown>;
	},
): CanvasElement {
	return createBaseCanvasElement(defaults, {
		type: "text",
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		fill: "transparent",
		stroke: input.textColor,
		strokeWidth: 1,
		text: input.text,
		textColor: input.textColor,
		fontSize: input.fontSize,
		fontFamily: input.fontFamily,
		textAlign: input.textAlign ?? "center",
		fontWeight: input.fontWeight,
		groupId: input.groupId ?? null,
		customData: input.customData,
	});
}

interface PositionedSequenceEvent {
	event: SequenceDiagramEvent;
	eventIndex: number;
	y: number;
	height: number;
	depth: number;
}

function getBlockDepths(events: SequenceDiagramEvent[]): number[] {
	let depth = 0;
	return events.map((event) => {
		if (event.type === "block-end") depth = Math.max(0, depth - 1);
		const current = depth;
		if (event.type === "block-start") depth += 1;
		return current;
	});
}

function isActorParticipant(participant: SequenceParticipant): boolean {
	return participant.kind === "actor";
}

function getSequenceParticipantHeaderWidth(labels: readonly string[]): number {
	const longest = labels.reduce(
		(max, label) => Math.max(max, label.trim().length),
		0,
	);
	return Math.max(150, Math.min(260, Math.ceil(longest * 8.5 + 36)));
}

export function layoutSequenceDiagram(
	document: SequenceDiagramDocument,
	options: Omit<CreateSequenceDiagramElementsOptions, "source">,
): CanvasElement[] {
	const appearance = options.appearance ?? {};
	const diagramId = options.diagramId ?? options.defaults.createId();
	const fontFamily =
		appearance.fontFamily ??
		options.defaults.fontFamily ??
		'"Kalam", "Architects Daughter", "Segoe Print", cursive';
	const stroke = appearance.stroke ?? options.defaults.stroke;
	const textColor = appearance.textColor ?? stroke;
	const participantFill = appearance.participantFill ?? "#ffffff";
	const participantStroke = appearance.participantStroke ?? stroke;
	const lifelineStroke = appearance.lifelineStroke ?? "#94A3B8";
	const messageStroke = appearance.messageStroke ?? stroke;
	const activationFill = appearance.activationFill ?? participantFill;
	const noteFill = appearance.noteFill ?? "#FEF3C7";
	const noteStroke = appearance.noteStroke ?? "#D97706";
	const noteTextColor = appearance.noteTextColor ?? "#713F12";
	const fragmentStroke = appearance.fragmentStroke ?? "#64748B";
	const fragmentFill = appearance.fragmentFill ?? "transparent";
	const estimatedHeaderWidth = getSequenceParticipantHeaderWidth(
		document.participants.map(({ label }) => label),
	);
	const participantGap = Math.max(
		180,
		options.participantGap ?? 240,
		estimatedHeaderWidth + 30,
	);
	const participantHeaderWidth = Math.min(
		estimatedHeaderWidth,
		participantGap - 30,
	);
	const participantHeaderHeight = 56;
	const titleHeight = document.title ? 52 : 0;
	const headerAreaHeight = 112;
	const eventHeights = document.events.map(getSequenceEventHeight);
	const totalEventsHeight = Math.max(
		Math.max(0, options.minEventAreaHeight ?? 0),
		eventHeights.reduce((sum, height) => sum + height, 0),
	);
	const totalHeight = titleHeight + headerAreaHeight + totalEventsHeight + 44;
	const participantSpan = Math.max(
		0,
		(document.participants.length - 1) * participantGap,
	);
	const diagramWidth = Math.max(
		participantHeaderWidth + 80,
		participantSpan + participantHeaderWidth + 80,
	);
	const diagramLeft = options.x - diagramWidth / 2;
	const firstParticipantX = diagramLeft + (diagramWidth - participantSpan) / 2;
	const diagramTop = options.y - totalHeight / 2;
	const participantTop = diagramTop + titleHeight;
	const lifelineTop = participantTop + headerAreaHeight - 10;
	const eventTop = participantTop + headerAreaHeight;
	const diagramBottom = diagramTop + totalHeight - 24;
	const participantX = new Map(
		document.participants.map((participant, index) => [
			participant.id,
			firstParticipantX + index * participantGap,
		]),
	);

	const depths = getBlockDepths(document.events);
	let nextY = eventTop;
	const positionedEvents: PositionedSequenceEvent[] = document.events.map(
		(event, eventIndex) => {
			const height = eventHeights[eventIndex];
			const positioned = {
				event,
				eventIndex,
				y: nextY,
				height,
				depth: depths[eventIndex],
			};
			nextY += height;
			return positioned;
		},
	);

	const backgrounds: CanvasElement[] = [];
	const lifelines: CanvasElement[] = [];
	const activations: CanvasElement[] = [];
	const foreground: CanvasElement[] = [];

	if (document.title) {
		foreground.push(
			createTextElement(options.defaults, {
				x: diagramLeft + 20,
				y: diagramTop,
				width: diagramWidth - 40,
				height: 36,
				text: document.title,
				fontSize: 24,
				fontFamily,
				textColor,
				fontWeight: "bold",
				customData: sequenceMeta(diagramId, "title"),
			}),
		);
	}

	for (const participant of document.participants) {
		const centerX = participantX.get(participant.id) ?? options.x;
		if (isActorParticipant(participant)) {
			const actorGroupId = options.defaults.createId();
			foreground.push(
				createBaseCanvasElement(options.defaults, {
					type: "ellipse",
					x: centerX - 11,
					y: participantTop,
					width: 22,
					height: 22,
					fill: participantFill,
					stroke: participantStroke,
					strokeWidth: 2,
					groupId: actorGroupId,
					customData: sequenceMeta(diagramId, "actor", {
						sequenceParticipantId: participant.id,
					}),
				}),
				createLineElement(
					options.defaults,
					[
						[centerX, participantTop + 22],
						[centerX, participantTop + 55],
					],
					{
						stroke: participantStroke,
						strokeWidth: 2,
						groupId: actorGroupId,
						customData: sequenceMeta(diagramId, "actor", {
							sequenceParticipantId: participant.id,
						}),
					},
				),
				createLineElement(
					options.defaults,
					[
						[centerX - 17, participantTop + 38],
						[centerX, participantTop + 29],
						[centerX + 17, participantTop + 38],
					],
					{
						stroke: participantStroke,
						strokeWidth: 2,
						groupId: actorGroupId,
						customData: sequenceMeta(diagramId, "actor", {
							sequenceParticipantId: participant.id,
						}),
					},
				),
				createLineElement(
					options.defaults,
					[
						[centerX - 16, participantTop + 68],
						[centerX, participantTop + 54],
						[centerX + 16, participantTop + 68],
					],
					{
						stroke: participantStroke,
						strokeWidth: 2,
						groupId: actorGroupId,
						customData: sequenceMeta(diagramId, "actor", {
							sequenceParticipantId: participant.id,
						}),
					},
				),
				createTextElement(options.defaults, {
					x: centerX - participantHeaderWidth / 2,
					y: participantTop + 72,
					width: participantHeaderWidth,
					height: 28,
					text: participant.label,
					fontSize: 16,
					fontFamily,
					textColor,
					fontWeight: "bold",
					groupId: actorGroupId,
					customData: sequenceMeta(diagramId, "actor", {
						sequenceParticipantId: participant.id,
					}),
				}),
			);
		} else {
			foreground.push(
				createBaseCanvasElement(options.defaults, {
					type: "rectangle",
					x: centerX - participantHeaderWidth / 2,
					y: participantTop + 20,
					width: participantHeaderWidth,
					height: participantHeaderHeight,
					fill: participantFill,
					stroke: participantStroke,
					strokeWidth: 2,
					cornerRadius: 8,
					text: participant.label,
					textColor,
					fontSize: 17,
					fontFamily,
					fontWeight: "bold",
					textAlign: "center",
					customData: sequenceMeta(diagramId, "participant", {
						sequenceParticipantId: participant.id,
					}),
				}),
			);
		}
		lifelines.push(
			createLineElement(
				options.defaults,
				[
					[centerX, lifelineTop],
					[centerX, diagramBottom],
				],
				{
					stroke: lifelineStroke,
					strokeWidth: 1.5,
					strokeStyle: "dashed",
					customData: sequenceMeta(diagramId, "lifeline", {
						sequenceParticipantId: participant.id,
					}),
				},
			),
		);
	}

	const openBlocks: Array<{
		position: PositionedSequenceEvent;
		startY: number;
	}> = [];
	for (const positioned of positionedEvents) {
		const { event, eventIndex, y, height, depth } = positioned;
		if (event.type === "block-start") {
			openBlocks.push({ position: positioned, startY: y + 4 });
			continue;
		}
		if (event.type === "block-divider") {
			const inset = depth * 12;
			const dividerY = y + 22;
			backgrounds.push(
				createLineElement(
					options.defaults,
					[
						[diagramLeft + 28 + inset, dividerY],
						[diagramLeft + diagramWidth - 28 - inset, dividerY],
					],
					{
						stroke: fragmentStroke,
						strokeWidth: 1,
						strokeStyle: "dashed",
						customData: sequenceMeta(diagramId, "fragment-divider", {
							sequenceEventIndex: eventIndex,
						}),
					},
				),
			);
			foreground.push(
				createTextElement(options.defaults, {
					x: diagramLeft + 38 + inset,
					y,
					width: Math.min(280, diagramWidth - 76 - inset * 2),
					height: 20,
					text: `${event.kind}${event.label ? ` ${event.label}` : ""}`,
					fontSize: 13,
					fontFamily,
					textColor: fragmentStroke,
					textAlign: "left",
					fontWeight: "bold",
					customData: sequenceMeta(diagramId, "fragment-label", {
						sequenceEventIndex: eventIndex,
					}),
				}),
			);
			continue;
		}
		if (event.type === "block-end") {
			const open = openBlocks.pop();
			if (!open) continue;
			const inset = open.position.depth * 12;
			const block = open.position.event as SequenceBlockStartEvent;
			const frameY = open.startY;
			const frameHeight = Math.max(48, y + height - frameY);
			backgrounds.push(
				createBaseCanvasElement(options.defaults, {
					type: "rectangle",
					x: diagramLeft + 18 + inset,
					y: frameY,
					width: diagramWidth - 36 - inset * 2,
					height: frameHeight,
					fill:
						block.kind === "rect"
							? (block.color ?? fragmentFill)
							: fragmentFill,
					stroke: block.kind === "rect" ? "transparent" : fragmentStroke,
					strokeWidth: block.kind === "rect" ? 0 : 1.5,
					cornerRadius: 6,
					customData: sequenceMeta(diagramId, "fragment", {
						sequenceEventIndex: open.position.eventIndex,
					}),
				}),
			);
			if (block.kind !== "rect") {
				foreground.push(
					createTextElement(options.defaults, {
						x: diagramLeft + 30 + inset,
						y: frameY + 6,
						width: Math.min(340, diagramWidth - 60 - inset * 2),
						height: 24,
						text: `${block.kind}${block.label ? ` ${block.label}` : ""}`,
						fontSize: 14,
						fontFamily,
						textColor: fragmentStroke,
						textAlign: "left",
						fontWeight: "bold",
						customData: sequenceMeta(diagramId, "fragment-label", {
							sequenceEventIndex: open.position.eventIndex,
						}),
					}),
				);
			}
		}
	}

	let sequenceNumber = document.autonumber?.start ?? 1;
	for (const positioned of positionedEvents) {
		const { event, eventIndex, y, height } = positioned;
		if (event.type === "message") {
			const fromX = participantX.get(event.from);
			const toX = participantX.get(event.to);
			if (fromX == null || toX == null) continue;
			const lineY = getEventAnchorY(event, positioned);
			const dotted = event.arrow.startsWith("--") || event.arrow === "<<-->>";
			const hasEndArrow =
				event.arrow.includes(">>") ||
				event.arrow.endsWith(")") ||
				event.arrow.endsWith("x");
			const hasStartArrow = event.arrow.startsWith("<<");
			const labelPrefix = document.autonumber ? `${sequenceNumber}. ` : "";
			const label = `${labelPrefix}${event.text}`;
			if (document.autonumber) {
				sequenceNumber += document.autonumber.increment;
			}
			if (fromX === toX) {
				const loopWidth = 72;
				const loopHeight = 38;
				foreground.push(
					createLineElement(
						options.defaults,
						[
							[fromX, lineY],
							[fromX + loopWidth, lineY],
							[fromX + loopWidth, lineY + loopHeight],
							[fromX, lineY + loopHeight],
						],
						{
							type: "arrow",
							stroke: messageStroke,
							strokeWidth: 2,
							strokeStyle: dotted ? "dashed" : "solid",
							arrowHeadStart: hasStartArrow ? "arrow" : "none",
							arrowHeadEnd: hasEndArrow ? "arrow" : "none",
							arrowHeadFilled: !event.arrow.endsWith(")"),
							customData: sequenceMeta(diagramId, "message", {
								sequenceSourceId: event.from,
								sequenceTargetId: event.to,
								sequenceEventIndex: eventIndex,
							}),
						},
					),
					createTextElement(options.defaults, {
						x: fromX + 10,
						y: y + 2,
						width: Math.max(120, Math.min(260, label.length * 8)),
						height: 24,
						text: label,
						fontSize: 14,
						fontFamily,
						textColor,
						textAlign: "left",
						customData: sequenceMeta(diagramId, "message-label", {
							sequenceSourceId: event.from,
							sequenceTargetId: event.to,
							sequenceEventIndex: eventIndex,
						}),
					}),
				);
			} else {
				foreground.push(
					createLineElement(
						options.defaults,
						[
							[fromX, lineY],
							[toX, lineY],
						],
						{
							type: "arrow",
							stroke: messageStroke,
							strokeWidth: 2,
							strokeStyle: dotted ? "dashed" : "solid",
							arrowHeadStart: hasStartArrow ? "arrow" : "none",
							arrowHeadEnd: hasEndArrow ? "arrow" : "none",
							arrowHeadFilled: !event.arrow.endsWith(")"),
							customData: sequenceMeta(diagramId, "message", {
								sequenceSourceId: event.from,
								sequenceTargetId: event.to,
								sequenceEventIndex: eventIndex,
							}),
						},
					),
				);
				const labelWidth = Math.max(
					120,
					Math.min(Math.abs(toX - fromX) - 24, Math.max(180, label.length * 8)),
				);
				foreground.push(
					createTextElement(options.defaults, {
						x: (fromX + toX) / 2 - labelWidth / 2,
						y: lineY - 27,
						width: labelWidth,
						height: 23,
						text: label,
						fontSize: 14,
						fontFamily,
						textColor,
						customData: sequenceMeta(diagramId, "message-label", {
							sequenceSourceId: event.from,
							sequenceTargetId: event.to,
							sequenceEventIndex: eventIndex,
						}),
					}),
				);
			}
			if (event.arrow.endsWith("x")) {
				foreground.push(
					createTextElement(options.defaults, {
						x: toX - 12,
						y: lineY - 15,
						width: 24,
						height: 30,
						text: "×",
						fontSize: 24,
						fontFamily,
						textColor: messageStroke,
						fontWeight: "bold",
						customData: sequenceMeta(diagramId, "destroy", {
							sequenceParticipantId: event.to,
							sequenceEventIndex: eventIndex,
						}),
					}),
				);
			}
			continue;
		}

		if (event.type === "note") {
			const centers = event.participantIds
				.map((id) => participantX.get(id))
				.filter((value): value is number => value != null);
			if (centers.length === 0) continue;
			const firstCenter = centers[0] as number;
			const lastCenter = centers[centers.length - 1] as number;
			const noteWidth =
				event.placement === "over" && centers.length > 1
					? Math.max(220, Math.abs(lastCenter - firstCenter) + 100)
					: 210;
			const center =
				centers.reduce((sum, value) => sum + value, 0) / centers.length;
			const noteX =
				event.placement === "left"
					? firstCenter - noteWidth - 28
					: event.placement === "right"
						? firstCenter + 28
						: center - noteWidth / 2;
			foreground.push(
				createBaseCanvasElement(options.defaults, {
					type: "rectangle",
					x: noteX,
					y: y + 8,
					width: noteWidth,
					height: height - 16,
					fill: noteFill,
					stroke: noteStroke,
					strokeWidth: 1.5,
					cornerRadius: 6,
					text: event.text,
					textColor: noteTextColor,
					fontSize: 14,
					fontFamily,
					textAlign: "center",
					customData: sequenceMeta(diagramId, "note", {
						sequenceParticipantId: event.participantIds.join(","),
						sequenceEventIndex: eventIndex,
					}),
				}),
			);
			continue;
		}

		if (event.type === "lifecycle" && event.action === "destroy") {
			const centerX = participantX.get(event.participantId);
			if (centerX == null) continue;
			foreground.push(
				createTextElement(options.defaults, {
					x: centerX - 14,
					y: y - 2,
					width: 28,
					height: 28,
					text: "×",
					fontSize: 25,
					fontFamily,
					textColor: messageStroke,
					fontWeight: "bold",
					customData: sequenceMeta(diagramId, "destroy", {
						sequenceParticipantId: event.participantId,
						sequenceEventIndex: eventIndex,
					}),
				}),
			);
		}
	}

	const activationStacks = new Map<
		string,
		Array<{ y: number; depth: number; eventIndex: number }>
	>();
	const closeActivation = (
		participantId: string,
		endY: number,
		eventIndex: number,
	) => {
		const stack = activationStacks.get(participantId);
		const open = stack?.pop();
		const centerX = participantX.get(participantId);
		if (!open || centerX == null) return;
		activations.push(
			createBaseCanvasElement(options.defaults, {
				type: "rectangle",
				x: centerX - 7 + open.depth * 5,
				y: open.y,
				width: 14,
				height: Math.max(18, endY - open.y),
				fill: activationFill,
				stroke: participantStroke,
				strokeWidth: 1.5,
				customData: sequenceMeta(diagramId, "activation", {
					sequenceParticipantId: participantId,
					sequenceEventIndex: eventIndex,
				}),
			}),
		);
	};
	const openActivation = (
		participantId: string,
		startY: number,
		eventIndex: number,
	) => {
		const stack = activationStacks.get(participantId) ?? [];
		stack.push({ y: startY, depth: stack.length, eventIndex });
		activationStacks.set(participantId, stack);
	};

	for (const positioned of positionedEvents) {
		const { event, eventIndex } = positioned;
		const anchorY = getEventAnchorY(event, positioned);
		if (event.type === "activation") {
			if (event.action === "activate") {
				openActivation(event.participantId, anchorY, eventIndex);
			} else {
				closeActivation(event.participantId, anchorY, eventIndex);
			}
		}
		if (event.type === "message" && event.activation === "+") {
			openActivation(event.to, anchorY, eventIndex);
		}
		if (event.type === "message" && event.activation === "-") {
			closeActivation(event.from, anchorY, eventIndex);
		}
	}
	for (const [participantId, stack] of activationStacks) {
		while (stack.length > 0) {
			closeActivation(
				participantId,
				diagramBottom,
				stack.at(-1)?.eventIndex ?? 0,
			);
		}
	}

	return [...backgrounds, ...lifelines, ...activations, ...foreground];
}

export function tryCreateSequenceDiagramElements(
	options: CreateSequenceDiagramElementsOptions,
): TryCreateSequenceDiagramElementsResult {
	const parsed = parseSequenceDiagram(options.source);
	const hasErrors = parsed.diagnostics.some(
		(diagnostic) => diagnostic.severity === "error",
	);
	return {
		...parsed,
		elements: hasErrors
			? []
			: layoutSequenceDiagram(parsed.document, {
					x: options.x,
					y: options.y,
					defaults: options.defaults,
					appearance: options.appearance,
					participantGap: options.participantGap,
					minEventAreaHeight: options.minEventAreaHeight,
					diagramId: options.diagramId,
				}),
	};
}

export function createSequenceDiagramElements(
	options: CreateSequenceDiagramElementsOptions,
): CanvasElement[] {
	const result = tryCreateSequenceDiagramElements(options);
	if (
		result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
	) {
		throw new SequenceDiagramParseError(result.diagnostics);
	}
	return result.elements;
}

export function isSequenceDiagramElement(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === SEQUENCE_DIAGRAM_ELEMENT_TYPE;
}

export function getSequenceDiagramElementMeta(
	element: CanvasElement | null | undefined,
): SequenceDiagramElementMeta | null {
	if (!isSequenceDiagramElement(element)) return null;
	const data = element?.customData;
	if (
		!data ||
		typeof data.sequenceDiagramId !== "string" ||
		typeof data.sequenceRole !== "string"
	) {
		return null;
	}
	return data as unknown as SequenceDiagramElementMeta;
}

/** Returns the logical diagram id shared by every generated sequence element. */
export function getSequenceDiagramId(
	element: CanvasElement | null | undefined,
): string | null {
	return getSequenceDiagramElementMeta(element)?.sequenceDiagramId ?? null;
}

function sequenceElementBottom(element: CanvasElement): number {
	return element.y + Math.max(1, element.height);
}

function sequenceElementRight(element: CanvasElement): number {
	return element.x + Math.max(1, element.width);
}

function getSequenceLifelineX(element: CanvasElement): number {
	return element.x + (element.points?.[0]?.[0] ?? 0);
}

function getDiagramElements(
	elements: Iterable<CanvasElement>,
	diagramId: string,
): CanvasElement[] {
	return Array.from(elements).filter(
		(element) =>
			getSequenceDiagramElementMeta(element)?.sequenceDiagramId === diagramId,
	);
}

/**
 * Reads the semantic sequence-diagram structure from ordinary canvas elements.
 * This keeps the visual builder host-neutral and also works for Mermaid imports.
 */
export function getSequenceDiagramSummaries(
	elements: Iterable<CanvasElement>,
): SequenceDiagramSummary[] {
	const byDiagram = new Map<string, CanvasElement[]>();
	for (const element of elements) {
		const meta = getSequenceDiagramElementMeta(element);
		if (!meta) continue;
		const bucket = byDiagram.get(meta.sequenceDiagramId) ?? [];
		bucket.push(element);
		byDiagram.set(meta.sequenceDiagramId, bucket);
	}

	return Array.from(byDiagram, ([diagramId, diagramElements]) => {
		const participantElements = new Map<string, CanvasElement[]>();
		const lifelines = new Map<string, CanvasElement>();
		let title: string | null = null;
		for (const element of diagramElements) {
			const meta = getSequenceDiagramElementMeta(element);
			if (!meta) continue;
			if (meta.sequenceRole === "title" && element.text) title = element.text;
			if (
				meta.sequenceRole === "lifeline" &&
				typeof meta.sequenceParticipantId === "string"
			) {
				lifelines.set(meta.sequenceParticipantId, element);
			}
			if (
				(meta.sequenceRole === "participant" ||
					meta.sequenceRole === "actor") &&
				typeof meta.sequenceParticipantId === "string"
			) {
				const bucket =
					participantElements.get(meta.sequenceParticipantId) ?? [];
				bucket.push(element);
				participantElements.set(meta.sequenceParticipantId, bucket);
			}
		}

		const participants = Array.from(
			participantElements,
			([participantId, headers]) => {
				const lifeline = lifelines.get(participantId);
				if (!lifeline) return null;
				const actor = headers.some(
					(element) =>
						getSequenceDiagramElementMeta(element)?.sequenceRole === "actor",
				);
				const labelElement = headers.find(
					(element) => typeof element.text === "string" && element.text.trim(),
				);
				return {
					id: participantId,
					label: labelElement?.text?.trim() || participantId,
					kind: actor ? ("actor" as const) : ("participant" as const),
					x: getSequenceLifelineX(lifeline),
					headerTop: Math.min(...headers.map((element) => element.y)),
					headerBottom: Math.max(...headers.map(sequenceElementBottom)),
					lifelineElementId: lifeline.id,
				};
			},
		).filter(
			(participant): participant is SequenceDiagramParticipantSummary =>
				participant !== null,
		);
		participants.sort((left, right) => left.x - right.x);

		const messages = diagramElements
			.filter(
				(element) =>
					getSequenceDiagramElementMeta(element)?.sequenceRole === "message",
			)
			.map((message): SequenceDiagramMessageSummary | null => {
				const meta = getSequenceDiagramElementMeta(message);
				if (
					!meta ||
					typeof meta.sequenceEventIndex !== "number" ||
					typeof meta.sequenceSourceId !== "string" ||
					typeof meta.sequenceTargetId !== "string"
				) {
					return null;
				}
				const label = diagramElements.find((candidate) => {
					const candidateMeta = getSequenceDiagramElementMeta(candidate);
					return (
						candidateMeta?.sequenceRole === "message-label" &&
						candidateMeta.sequenceEventIndex === meta.sequenceEventIndex
					);
				});
				return {
					eventIndex: meta.sequenceEventIndex,
					fromParticipantId: meta.sequenceSourceId,
					toParticipantId: meta.sequenceTargetId,
					label: label?.text?.trim() || "Message",
					kind: meta.sequenceMessageKind ?? "synchronous",
					y: message.y,
					messageElementId: message.id,
					labelElementId: label?.id ?? null,
				};
			})
			.filter(
				(message): message is SequenceDiagramMessageSummary => message !== null,
			)
			.sort(
				(left, right) => left.y - right.y || left.eventIndex - right.eventIndex,
			);

		const minX = Math.min(...diagramElements.map((element) => element.x));
		const minY = Math.min(...diagramElements.map((element) => element.y));
		const maxX = Math.max(...diagramElements.map(sequenceElementRight));
		const maxY = Math.max(...diagramElements.map(sequenceElementBottom));
		const lifelineElements = Array.from(lifelines.values());
		const eventTop =
			Math.min(...lifelineElements.map((element) => element.y)) + 42;
		const flowElements = diagramElements.filter((element) => {
			const role = getSequenceDiagramElementMeta(element)?.sequenceRole;
			return (
				role !== "title" &&
				role !== "participant" &&
				role !== "actor" &&
				role !== "lifeline"
			);
		});
		const nextEventY = Math.max(
			eventTop,
			...flowElements.map((element) => sequenceElementBottom(element) + 34),
		);
		return {
			id: diagramId,
			title,
			participants,
			messages,
			bounds: {
				x: minX,
				y: minY,
				width: Math.max(1, maxX - minX),
				height: Math.max(1, maxY - minY),
			},
			eventTop,
			nextEventY,
			lifelineBottom: Math.max(
				eventTop + 120,
				...lifelineElements.map(sequenceElementBottom),
			),
		};
	});
}

export function resolveActiveSequenceDiagram(
	elements: Iterable<CanvasElement>,
	selectedElements: readonly CanvasElement[] = [],
): SequenceDiagramSummary | null {
	const summaries = getSequenceDiagramSummaries(elements);
	const selectedDiagramId = selectedElements
		.map(getSequenceDiagramElementMeta)
		.find(Boolean)?.sequenceDiagramId;
	return (
		summaries.find((summary) => summary.id === selectedDiagramId) ??
		summaries.at(-1) ??
		null
	);
}

function createVisualPresetDocument(
	preset: SequenceVisualPreset,
): SequenceDiagramDocument {
	if (preset === "blank") {
		return {
			title: "Sequence diagram",
			autonumber: null,
			participants: [
				{ id: "customer", label: "Customer", kind: "actor", line: 0 },
				{ id: "service", label: "Service", kind: "participant", line: 0 },
				{ id: "api", label: "API", kind: "participant", line: 0 },
			],
			events: [],
		};
	}
	return {
		title: "Checkout flow",
		autonumber: null,
		participants: [
			{ id: "customer", label: "Customer", kind: "actor", line: 0 },
			{ id: "store", label: "Online Store", kind: "participant", line: 0 },
			{ id: "inventory", label: "Inventory", kind: "participant", line: 0 },
			{ id: "payment", label: "Payment Gateway", kind: "participant", line: 0 },
			{ id: "shipping", label: "Shipping", kind: "participant", line: 0 },
		],
		events: [
			{
				type: "message",
				from: "customer",
				to: "store",
				text: "Proceed to checkout",
				arrow: "->>",
				activation: "+",
				line: 0,
			},
			{
				type: "message",
				from: "store",
				to: "inventory",
				text: "Check availability",
				arrow: "->>",
				activation: null,
				line: 0,
			},
			{
				type: "message",
				from: "inventory",
				to: "store",
				text: "Items available",
				arrow: "-->>",
				activation: null,
				line: 0,
			},
			{
				type: "block-start",
				kind: "alt",
				label: "Payment successful",
				line: 0,
			},
			{
				type: "message",
				from: "store",
				to: "payment",
				text: "Process payment",
				arrow: "->>",
				activation: "+",
				line: 0,
			},
			{
				type: "message",
				from: "payment",
				to: "store",
				text: "Payment confirmed",
				arrow: "-->>",
				activation: "-",
				line: 0,
			},
			{
				type: "message",
				from: "store",
				to: "shipping",
				text: "Arrange delivery",
				arrow: "->>",
				activation: null,
				line: 0,
			},
			{ type: "block-divider", kind: "else", label: "Payment failed", line: 0 },
			{
				type: "message",
				from: "payment",
				to: "store",
				text: "Payment declined",
				arrow: "-->>",
				activation: null,
				line: 0,
			},
			{ type: "block-end", line: 0 },
		],
	};
}

export function createVisualSequenceDiagramElements(
	options: CreateVisualSequenceDiagramOptions,
): CanvasElement[] {
	return layoutSequenceDiagram(createVisualPresetDocument(options.preset), {
		x: options.x,
		y: options.y,
		defaults: options.defaults,
		appearance: options.appearance,
		minEventAreaHeight: options.preset === "blank" ? 320 : undefined,
		diagramId: options.diagramId,
	});
}

function nextSequenceEventIndex(elements: readonly CanvasElement[]): number {
	return (
		Math.max(
			-1,
			...elements.map(
				(element) =>
					getSequenceDiagramElementMeta(element)?.sequenceEventIndex ?? -1,
			),
		) + 1
	);
}

function uniqueSequenceParticipantId(
	label: string,
	participants: readonly SequenceDiagramParticipantSummary[],
): string {
	const base =
		label
			.normalize("NFKD")
			.replace(/\p{Mark}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-|-$/gu, "") || "participant";
	const used = new Set(participants.map((participant) => participant.id));
	let candidate = base;
	let suffix = 2;
	while (used.has(candidate)) candidate = `${base}-${suffix++}`;
	return candidate;
}

function extendSequenceLifelines(
	diagramElements: readonly CanvasElement[],
	bottom: number,
): CanvasMutationPlan["update"] {
	return diagramElements.flatMap((element) => {
		const meta = getSequenceDiagramElementMeta(element);
		if (meta?.sequenceRole !== "lifeline") return [];
		const currentBottom = sequenceElementBottom(element);
		if (currentBottom >= bottom) return [];
		const height = Math.max(1, bottom - element.y);
		return [
			{
				id: element.id,
				changes: {
					height,
					points: [
						[0, 0],
						[0, height],
					],
				},
			},
		];
	});
}

function resolvedVisualAppearance(
	defaults: CanvasElementFactoryDefaults,
	appearance: SequenceDiagramAppearance | undefined,
) {
	const stroke = appearance?.stroke ?? defaults.stroke;
	return {
		fontFamily:
			appearance?.fontFamily ??
			defaults.fontFamily ??
			'"Kalam", "Architects Daughter", "Segoe Print", cursive',
		textColor: appearance?.textColor ?? stroke,
		participantFill: appearance?.participantFill ?? "#ffffff",
		participantStroke: appearance?.participantStroke ?? stroke,
		lifelineStroke: appearance?.lifelineStroke ?? "#94A3B8",
		messageStroke: appearance?.messageStroke ?? stroke,
		activationFill: appearance?.activationFill ?? "#ffffff",
		fragmentStroke: appearance?.fragmentStroke ?? "#64748B",
		fragmentFill: appearance?.fragmentFill ?? "transparent",
	};
}

export function planSequenceDiagramParticipantInsertion(
	options: AddSequenceDiagramParticipantOptions,
): CanvasMutationPlan | null {
	const summary = getSequenceDiagramSummaries(options.elements.values()).find(
		(candidate) => candidate.id === options.diagramId,
	);
	if (!summary) return null;
	const diagramElements = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	);
	const participantId = uniqueSequenceParticipantId(
		options.label,
		summary.participants,
	);
	const template = layoutSequenceDiagram(
		{
			title: null,
			autonumber: null,
			participants: [
				{
					id: participantId,
					label: options.label.trim() || "Participant",
					kind: options.kind,
					line: 0,
				},
			],
			events: [],
		},
		{
			x: 0,
			y: 0,
			defaults: options.defaults,
			appearance: options.appearance,
			minEventAreaHeight: Math.max(
				240,
				summary.lifelineBottom - summary.eventTop,
			),
			diagramId: options.diagramId,
		},
	);
	const templateSummary = getSequenceDiagramSummaries(template)[0];
	const templateParticipant = templateSummary?.participants[0];
	if (!templateSummary || !templateParticipant) return null;
	const targetX =
		Math.max(...summary.participants.map((participant) => participant.x)) +
		Math.max(
			180,
			options.participantGap ?? 240,
			getSequenceParticipantHeaderWidth([options.label]) + 30,
		);
	const targetHeaderTop = Math.min(
		...summary.participants.map((participant) => participant.headerTop),
	);
	const dx = targetX - templateParticipant.x;
	const dy = targetHeaderTop - templateParticipant.headerTop;
	const create = template.map((element) => {
		const translated = { ...element, x: element.x + dx, y: element.y + dy };
		if (getSequenceDiagramElementMeta(element)?.sequenceRole !== "lifeline") {
			return translated;
		}
		const lifelineTop = Math.min(
			...diagramElements
				.filter(
					(candidate) =>
						getSequenceDiagramElementMeta(candidate)?.sequenceRole ===
						"lifeline",
				)
				.map((candidate) => candidate.y),
		);
		const height = Math.max(1, summary.lifelineBottom - lifelineTop);
		return {
			...translated,
			y: lifelineTop,
			height,
			stackIndex: createStackIndexBefore(diagramElements, translated.id),
			points: [
				[0, 0],
				[0, height],
			] as [number, number][],
		};
	});
	return {
		create,
		update: [],
		deleteIds: [],
		selectedIds: create
			.filter((element) => {
				const role = getSequenceDiagramElementMeta(element)?.sequenceRole;
				return role === "participant" || role === "actor";
			})
			.map((element) => element.id),
	};
}

export function planSequenceDiagramMessageInsertion(
	options: AddSequenceDiagramMessageOptions,
): CanvasMutationPlan | null {
	const summary = getSequenceDiagramSummaries(options.elements.values()).find(
		(candidate) => candidate.id === options.diagramId,
	);
	if (!summary) return null;
	const from = summary.participants.find(
		(participant) => participant.id === options.fromParticipantId,
	);
	const requestedTarget = summary.participants.find(
		(participant) => participant.id === options.toParticipantId,
	);
	const to = options.kind === "self" ? from : requestedTarget;
	if (!from || !to) return null;
	const appearance = resolvedVisualAppearance(
		options.defaults,
		options.appearance,
	);
	const diagramElements = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	);
	const eventIndex = nextSequenceEventIndex(diagramElements);
	const lineY = summary.nextEventY;
	const self = from.id === to.id;
	const messageKind = self ? "self" : options.kind;
	const points: [number, number][] = self
		? [
				[from.x, lineY],
				[from.x + 72, lineY],
				[from.x + 72, lineY + 40],
				[from.x, lineY + 40],
			]
		: [
				[from.x, lineY],
				[to.x, lineY],
			];
	const message = createLineElement(options.defaults, points, {
		type: "arrow",
		stroke: appearance.messageStroke,
		strokeWidth: 2,
		strokeStyle: options.kind === "return" ? "dashed" : "solid",
		arrowHeadStart: "none",
		arrowHeadEnd: "arrow",
		arrowHeadFilled: options.kind === "synchronous" || options.kind === "self",
		customData: sequenceMeta(options.diagramId, "message", {
			sequenceSourceId: from.id,
			sequenceTargetId: to.id,
			sequenceEventIndex: eventIndex,
			sequenceMessageKind: messageKind,
		}),
	});
	const labelText = options.label.trim() || "Message";
	const labelWidth = self
		? Math.max(120, Math.min(240, labelText.length * 8))
		: Math.max(
				120,
				Math.min(
					Math.abs(to.x - from.x) - 24,
					Math.max(180, labelText.length * 8),
				),
			);
	const label = createTextElement(options.defaults, {
		x: self ? from.x + 10 : (from.x + to.x) / 2 - labelWidth / 2,
		y: lineY - 27,
		width: labelWidth,
		height: 23,
		text: labelText,
		fontSize: 14,
		fontFamily: appearance.fontFamily,
		textColor: appearance.textColor,
		textAlign: self ? "left" : "center",
		customData: sequenceMeta(options.diagramId, "message-label", {
			sequenceSourceId: from.id,
			sequenceTargetId: to.id,
			sequenceEventIndex: eventIndex,
			sequenceMessageKind: messageKind,
		}),
	});
	const create = [message, label];
	return {
		create,
		update: extendSequenceLifelines(diagramElements, lineY + (self ? 100 : 76)),
		deleteIds: [],
		selectedIds: create.map((element) => element.id),
	};
}

export function planSequenceDiagramMessageUpdate(
	options: UpdateSequenceDiagramMessageOptions,
): CanvasMutationPlan | null {
	const diagramElements = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	);
	const existing = diagramElements.filter((element) => {
		const meta = getSequenceDiagramElementMeta(element);
		return (
			meta?.sequenceEventIndex === options.eventIndex &&
			(meta.sequenceRole === "message" || meta.sequenceRole === "message-label")
		);
	});
	const existingMessage = existing.find(
		(element) =>
			getSequenceDiagramElementMeta(element)?.sequenceRole === "message",
	);
	if (!existingMessage) return null;

	const insertion = planSequenceDiagramMessageInsertion(options);
	if (!insertion) return null;
	const createdMessage = insertion.create.find(
		(element) =>
			getSequenceDiagramElementMeta(element)?.sequenceRole === "message",
	);
	if (!createdMessage) return null;
	const dy = existingMessage.y - createdMessage.y;
	const create = insertion.create.map((element) => ({
		...element,
		y: element.y + dy,
		customData: {
			...element.customData,
			sequenceEventIndex: options.eventIndex,
		},
	}));
	return {
		create,
		update: [],
		deleteIds: existing.map(({ id }) => id),
		selectedIds: create.map(({ id }) => id),
	};
}

export function planSequenceDiagramMessageDeletion(
	options: DeleteSequenceDiagramMessageOptions,
): CanvasMutationPlan | null {
	const deleteIds = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	)
		.filter((element) => {
			const meta = getSequenceDiagramElementMeta(element);
			return (
				meta?.sequenceEventIndex === options.eventIndex &&
				(meta.sequenceRole === "message" ||
					meta.sequenceRole === "message-label")
			);
		})
		.map(({ id }) => id);
	if (deleteIds.length === 0) return null;
	return {
		create: [],
		update: [],
		deleteIds,
		selectedIds: [],
	};
}

export function planSequenceDiagramActivationInsertion(
	options: AddSequenceDiagramActivationOptions,
): CanvasMutationPlan | null {
	const summary = getSequenceDiagramSummaries(options.elements.values()).find(
		(candidate) => candidate.id === options.diagramId,
	);
	const participant = summary?.participants.find(
		(candidate) => candidate.id === options.participantId,
	);
	if (!summary || !participant) return null;
	const appearance = resolvedVisualAppearance(
		options.defaults,
		options.appearance,
	);
	const diagramElements = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	);
	const messageElements = diagramElements.filter(
		(element) =>
			getSequenceDiagramElementMeta(element)?.sequenceRole === "message",
	);
	const lastMessage = messageElements.sort(
		(left, right) => sequenceElementBottom(right) - sequenceElementBottom(left),
	)[0];
	const startY = lastMessage?.y ?? summary.nextEventY;
	const height = Math.max(48, options.height ?? 104);
	const activation = createBaseCanvasElement(options.defaults, {
		type: "rectangle",
		x: participant.x - 7,
		y: startY,
		width: 14,
		height,
		fill: appearance.activationFill,
		stroke: appearance.participantStroke,
		strokeWidth: 1.5,
		customData: sequenceMeta(options.diagramId, "activation", {
			sequenceParticipantId: participant.id,
			sequenceEventIndex: nextSequenceEventIndex(diagramElements),
		}),
	});
	return {
		create: [activation],
		update: extendSequenceLifelines(diagramElements, startY + height + 34),
		deleteIds: [],
		selectedIds: [activation.id],
	};
}

export function planSequenceDiagramFragmentInsertion(
	options: AddSequenceDiagramFragmentOptions,
): CanvasMutationPlan | null {
	const summary = getSequenceDiagramSummaries(options.elements.values()).find(
		(candidate) => candidate.id === options.diagramId,
	);
	if (!summary || summary.participants.length === 0) return null;
	const appearance = resolvedVisualAppearance(
		options.defaults,
		options.appearance,
	);
	const diagramElements = getDiagramElements(
		options.elements.values(),
		options.diagramId,
	);
	const flowElements = diagramElements.filter((element) => {
		const role = getSequenceDiagramElementMeta(element)?.sequenceRole;
		return (
			role === "message" || role === "message-label" || role === "activation"
		);
	});
	const wrap = options.wrapCurrentFlow !== false && flowElements.length > 0;
	const minParticipantX = Math.min(
		...summary.participants.map((participant) => participant.x),
	);
	const maxParticipantX = Math.max(
		...summary.participants.map((participant) => participant.x),
	);
	const x = minParticipantX - 112;
	const flowTop = wrap
		? Math.min(...flowElements.map((element) => element.y))
		: summary.nextEventY;
	const y = wrap
		? Math.max(
				Math.max(
					...summary.participants.map(
						(participant) => participant.headerBottom,
					),
				) + 20,
				Math.min(summary.eventTop - 18, flowTop - 36),
			)
		: summary.nextEventY;
	const wrappedFlowOffset = wrap ? Math.max(0, y + 44 - flowTop) : 0;
	const bottom = wrap
		? Math.max(...flowElements.map(sequenceElementBottom)) +
			wrappedFlowOffset +
			36
		: y + 160;
	const width = maxParticipantX - minParticipantX + 224;
	const height = Math.max(100, bottom - y);
	const eventIndex = nextSequenceEventIndex(diagramElements);
	const frameDraft = createBaseCanvasElement(options.defaults, {
		type: "rectangle",
		x,
		y,
		width,
		height,
		fill: appearance.fragmentFill,
		stroke: appearance.fragmentStroke,
		strokeWidth: 1.5,
		strokeStyle: "dashed",
		cornerRadius: 6,
		customData: sequenceMeta(options.diagramId, "fragment", {
			sequenceEventIndex: eventIndex,
			sequenceFragmentKind: options.kind,
		}),
	});
	const frame = {
		...frameDraft,
		stackIndex: createStackIndexBefore(diagramElements, frameDraft.id),
	};
	const labelText = `${options.kind}${options.label.trim() ? ` [${options.label.trim()}]` : ""}`;
	const label = createTextElement(options.defaults, {
		x: x + 12,
		y: y + 8,
		width: Math.min(320, width - 24),
		height: 24,
		text: labelText,
		fontSize: 14,
		fontFamily: appearance.fontFamily,
		textColor: appearance.fragmentStroke,
		textAlign: "left",
		fontWeight: "bold",
		customData: sequenceMeta(options.diagramId, "fragment-label", {
			sequenceEventIndex: eventIndex,
			sequenceFragmentKind: options.kind,
		}),
	});
	const dividerDraft =
		options.kind === "alt"
			? createLineElement(
					options.defaults,
					[
						[x, y + height / 2],
						[x + width, y + height / 2],
					],
					{
						stroke: appearance.fragmentStroke,
						strokeWidth: 1,
						strokeStyle: "dashed",
						customData: sequenceMeta(options.diagramId, "fragment-divider", {
							sequenceEventIndex: eventIndex,
							sequenceFragmentKind: options.kind,
						}),
					},
				)
			: null;
	const divider = dividerDraft
		? {
				...dividerDraft,
				stackIndex: createStackIndexBefore(diagramElements, dividerDraft.id),
			}
		: null;
	const create = [frame, ...(divider ? [divider] : []), label];
	return {
		create,
		update: [
			...(wrappedFlowOffset > 0
				? flowElements.map((element) => ({
						id: element.id,
						changes: { y: element.y + wrappedFlowOffset },
					}))
				: []),
			...extendSequenceLifelines(diagramElements, y + height + 34),
		],
		deleteIds: [],
		selectedIds: create.map((element) => element.id),
	};
}

/** Routes a semantic edit action to the same planners used by the visual editor. */
export function planSequenceDiagramEdit(
	options: PlanSequenceDiagramEditOptions,
): CanvasMutationPlan | null {
	const base = {
		elements: options.elements,
		diagramId: options.diagramId,
		defaults: options.defaults,
		appearance: options.appearance,
	};
	switch (options.action.operation) {
		case "add_participant":
			return planSequenceDiagramParticipantInsertion({
				...base,
				label: options.action.label,
				kind: options.action.kind,
			});
		case "add_message":
			return planSequenceDiagramMessageInsertion({
				...base,
				fromParticipantId: options.action.fromParticipantId,
				toParticipantId: options.action.toParticipantId,
				label: options.action.label,
				kind: options.action.kind,
			});
		case "update_message":
			return planSequenceDiagramMessageUpdate({
				...base,
				eventIndex: options.action.eventIndex,
				fromParticipantId: options.action.fromParticipantId,
				toParticipantId: options.action.toParticipantId,
				label: options.action.label,
				kind: options.action.kind,
			});
		case "delete_message":
			return planSequenceDiagramMessageDeletion({
				...base,
				eventIndex: options.action.eventIndex,
			});
		case "add_activation":
			return planSequenceDiagramActivationInsertion({
				...base,
				participantId: options.action.participantId,
				height: options.action.height,
			});
		case "add_fragment":
			return planSequenceDiagramFragmentInsertion({
				...base,
				kind: options.action.kind,
				label: options.action.label,
				wrapCurrentFlow: options.action.wrapCurrentFlow,
			});
	}
}
