import type { SequenceVisualMessageKind } from "@skedra/canvas-core";

export interface SequenceBuilderParticipant {
	id: string;
	label: string;
	kind: "actor" | "participant";
}

export interface SequenceBuilderStep {
	id: string;
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
}

export interface RecognizedSequenceDraft {
	participants: SequenceBuilderParticipant[];
	steps: SequenceBuilderStep[];
}

export interface SequenceBuilderStructure {
	kind: "condition" | "repeat";
	label: string;
}

const KNOWN_PARTICIPANTS = [
	{
		pattern: /\b(kunde|kundin|customer|user|nutzer(?:in)?)\b/i,
		label: "Kunde",
		kind: "actor" as const,
	},
	{
		pattern: /\b(service|backend|server)\b/i,
		label: "Service",
		kind: "participant" as const,
	},
	{ pattern: /\bapi\b/i, label: "API", kind: "participant" as const },
	{
		pattern: /\b(datenbank|database|db)\b/i,
		label: "Datenbank",
		kind: "participant" as const,
	},
	{
		pattern: /\b(app|web[- ]?app|shop|store)\b/i,
		label: "App",
		kind: "participant" as const,
	},
	{
		pattern: /\b(payment|zahlungssystem|zahlungsdienst)\b/i,
		label: "Zahlung",
		kind: "participant" as const,
	},
] as const;

function participantId(label: string, index: number) {
	const base =
		label
			.normalize("NFKD")
			.replace(/\p{M}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "participant";
	return `${base}-${index + 1}`;
}

function actionLabel(sentence: string) {
	const normalized = sentence.trim().replace(/^[,;:\s]+|[,;:\s]+$/g, "");
	if (
		/bestell/i.test(normalized) &&
		/(send|schick|übermittel)/i.test(normalized)
	) {
		return "Bestellung senden";
	}
	if (
		/(daten|angaben)/i.test(normalized) &&
		/(prüf|validier)/i.test(normalized)
	) {
		return "Daten prüfen";
	}
	if (/bestätig/i.test(normalized)) return "Bestätigung";
	if (/(fehler|fehlgeschlagen|ungültig)/i.test(normalized)) {
		return "Fehlermeldung anzeigen";
	}
	if (/(speicher|sicher)/i.test(normalized)) return "Daten speichern";
	if (/(login|anmeld)/i.test(normalized)) return "Anmeldedaten senden";
	if (/(zahl|payment)/i.test(normalized)) return "Zahlung verarbeiten";

	const withoutSubject = normalized
		.replace(/^(wenn|falls|danach|anschließend|dann)\s+/i, "")
		.replace(/^(ein|eine|der|die|das)\s+[\p{L}\d_-]+\s+/iu, "")
		.replace(/\s+(an|über|via)\s+(den|die|das)?\s*[\p{L}\d_-]+.*$/iu, "")
		.trim();
	const fallback = withoutSubject || normalized;
	return `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}`.slice(0, 72);
}

export function recognizeSequenceDescription(
	description: string,
): RecognizedSequenceDraft {
	const sentences = description
		.split(/[.!?\n]+/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
	const participants: SequenceBuilderParticipant[] = [];
	const participantByLabel = new Map<string, SequenceBuilderParticipant>();
	const ensureParticipant = (
		label: string,
		kind: SequenceBuilderParticipant["kind"] = "participant",
	) => {
		const existing = participantByLabel.get(label);
		if (existing) return existing;
		const participant = {
			id: participantId(label, participants.length),
			label,
			kind,
		};
		participants.push(participant);
		participantByLabel.set(label, participant);
		return participant;
	};

	const steps: SequenceBuilderStep[] = [];
	for (const sentence of sentences) {
		const mentions = KNOWN_PARTICIPANTS.flatMap((known) => {
			const match = known.pattern.exec(sentence);
			return match
				? [
						{
							index: match.index,
							participant: ensureParticipant(known.label, known.kind),
						},
					]
				: [];
		}).sort((left, right) => left.index - right.index);

		let from: SequenceBuilderParticipant | undefined = mentions[0]?.participant;
		let to: SequenceBuilderParticipant | undefined = mentions[1]?.participant;
		if (
			mentions.length === 1 &&
			/\b(erhält|bekommt|receives?)\b/i.test(sentence)
		) {
			to = mentions[0].participant;
			from = steps.length
				? participants.find(
						(participant) => participant.id === steps.at(-1)?.toParticipantId,
					)
				: ensureParticipant("Service");
		}
		if (!from && steps.length > 0) {
			from = participants.find(
				(participant) => participant.id === steps.at(-1)?.toParticipantId,
			);
		}
		if (!from) continue;
		if (!to) {
			to =
				from.kind === "actor"
					? ensureParticipant("Service")
					: ensureParticipant("Kunde", "actor");
		}
		const label = actionLabel(sentence);
		const isReturn =
			/\b(antwort|bestätig|zurück|response|return|erhält|bekommt)\b/i.test(
				sentence,
			);
		steps.push({
			id: `step-${steps.length + 1}`,
			fromParticipantId: from.id,
			toParticipantId: to.id,
			label,
			kind: isReturn ? "return" : "synchronous",
		});
	}

	return { participants, steps };
}

function safeMermaidId(value: string, index: number) {
	const normalized = value.replace(/[^a-zA-Z0-9_]/g, "_");
	return normalized && /^[a-zA-Z_]/.test(normalized)
		? normalized
		: `participant_${index + 1}`;
}

export function buildSequenceDiagramSource(
	participants: readonly SequenceBuilderParticipant[],
	steps: readonly SequenceBuilderStep[],
	title = "Ablauf",
	structure?: SequenceBuilderStructure | null,
) {
	const ids = new Map(
		participants.map((participant, index) => [
			participant.id,
			safeMermaidId(participant.id, index),
		]),
	);
	const lines = ["sequenceDiagram", `    title ${title.trim() || "Ablauf"}`];
	for (const participant of participants) {
		const keyword = participant.kind === "actor" ? "actor" : "participant";
		lines.push(
			`    ${keyword} ${ids.get(participant.id)} as ${participant.label.replace(/[\r\n]+/g, " ")}`,
		);
	}
	if (structure) {
		lines.push(
			`    ${structure.kind === "repeat" ? "loop" : "alt"} ${structure.label.trim() || (structure.kind === "repeat" ? "Wiederholung" : "Bedingung")}`,
		);
	}
	for (const step of steps) {
		const from = ids.get(step.fromParticipantId);
		const to = ids.get(step.toParticipantId);
		if (!from || !to || !step.label.trim()) continue;
		const arrow =
			step.kind === "return"
				? "-->>"
				: step.kind === "asynchronous"
					? "-)"
					: "->>";
		lines.push(
			`    ${from}${arrow}${step.kind === "self" ? from : to}: ${step.label.replace(/[\r\n:]+/g, " ").trim()}`,
		);
	}
	if (structure) lines.push("    end");
	return lines.join("\n");
}
