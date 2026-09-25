import {
	type CanvasElement,
	DEFAULT_SEQUENCE_DIAGRAM_SOURCE,
	type SequenceVisualFragmentKind,
	type SequenceVisualMessageKind,
	type SequenceVisualPreset,
	getSequenceDiagramId,
	getSequenceDiagramSummaries,
	parseSequenceDiagram,
} from "@skedra/canvas-core";
import {
	AlertCircle,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Box,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileText,
	GitBranch,
	Pencil,
	Plus,
	RotateCcw,
	Trash2,
	UserRound,
	Workflow,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type SequenceBuilderParticipant,
	buildSequenceDiagramSource,
	recognizeSequenceDescription,
} from "./sequence-diagram-builder";
import { useCanvasEditorFloatingPanel } from "./use-canvas-editor-floating-panel";
export type CanvasEditorSequenceDiagramTranslate = (
	key: string,
	fallback: string,
) => string;

export interface CanvasEditorSequenceDiagramPanelProps {
	elements?: ReadonlyMap<string, CanvasElement>;
	selectedElements?: readonly CanvasElement[];
	defaultSource?: string;
	defaultTab?: "visual" | "mermaid";
	translate?: CanvasEditorSequenceDiagramTranslate;
	className?: string;
	style?: CSSProperties;
	onCreateVisualDiagram?: (preset: SequenceVisualPreset) => void;
	onAddParticipant?: (
		diagramId: string,
		input: { label: string; kind: "actor" | "participant" },
	) => void;
	onAddMessage?: (
		diagramId: string,
		input: {
			fromParticipantId: string;
			toParticipantId: string;
			label: string;
			kind: SequenceVisualMessageKind;
		},
	) => void;
	onUpdateMessage?: (
		diagramId: string,
		input: {
			eventIndex: number;
			fromParticipantId: string;
			toParticipantId: string;
			label: string;
			kind: SequenceVisualMessageKind;
		},
	) => void;
	onDeleteMessage?: (diagramId: string, eventIndex: number) => void;
	onMoveMessage?: (
		diagramId: string,
		eventIndex: number,
		direction: "up" | "down",
	) => void;
	onDeleteFragment?: (diagramId: string, eventIndex: number) => void;
	onAddActivation?: (diagramId: string, participantId: string) => void;
	onAddFragment?: (
		diagramId: string,
		input: { kind: SequenceVisualFragmentKind; label: string },
	) => void;
	/** Return the new diagram ID to continue editing it immediately. */
	// biome-ignore lint/suspicious/noConfusingVoidType: Existing hosts may provide a callback that returns void.
	onInsert: (source: string) => string | void;
	onClose?: () => void;
}

interface SequenceStepForm {
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
}
const EMPTY_FORM: SequenceStepForm = {
	fromParticipantId: "",
	toParticipantId: "",
	label: "",
	kind: "synchronous",
};
const EMPTY_ELEMENTS = new Map<string, CanvasElement>();
const fallbackTranslate: CanvasEditorSequenceDiagramTranslate = (
	_key,
	fallback,
) => fallback;

export function CanvasEditorSequenceDiagramPanel({
	elements = EMPTY_ELEMENTS,
	selectedElements = [],
	defaultSource = DEFAULT_SEQUENCE_DIAGRAM_SOURCE,
	defaultTab = "visual",
	translate: t = fallbackTranslate,
	className,
	style,
	onAddParticipant,
	onAddMessage,
	onUpdateMessage,
	onDeleteMessage,
	onMoveMessage,
	onDeleteFragment,
	onAddFragment,
	onInsert,
	onClose,
}: CanvasEditorSequenceDiagramPanelProps) {
	const floatingPanel = useCanvasEditorFloatingPanel();
	const descriptionId = useId();
	const nextParticipant = useRef(0);
	const actionInput = useRef<HTMLInputElement>(null);
	const composerRef = useRef<HTMLFormElement>(null);
	const [activeTab, setActiveTab] = useState<"builder" | "mermaid">(
		defaultTab === "mermaid" ? "mermaid" : "builder",
	);
	const [source, setSource] = useState(defaultSource);
	const [description, setDescription] = useState("");
	const [descriptionOpen, setDescriptionOpen] = useState(false);
	const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
	const [draftParticipants, setDraftParticipants] = useState<
		SequenceBuilderParticipant[]
	>([]);
	const [activeDiagramId, setActiveDiagramId] = useState<string | null>(
		() => selectedElements.map(getSequenceDiagramId).find(Boolean) ?? null,
	);
	const [addingParticipant, setAddingParticipant] = useState(false);
	const [participantLabel, setParticipantLabel] = useState("");
	const [participantKind, setParticipantKind] = useState<
		"actor" | "participant"
	>("participant");
	const [editingEventIndex, setEditingEventIndex] = useState<number | null>(
		null,
	);
	const [stepForm, setStepForm] = useState<SequenceStepForm>(EMPTY_FORM);
	const [structureOpen, setStructureOpen] = useState(false);
	const [structureKind, setStructureKind] = useState<"condition" | "repeat">(
		"condition",
	);
	const [structureLabel, setStructureLabel] = useState("");

	const diagrams = useMemo(
		() => getSequenceDiagramSummaries(elements.values()),
		[elements],
	);
	const selectedDiagramId =
		selectedElements.map(getSequenceDiagramId).find(Boolean) ?? null;

	// Follow a newly selected diagram, while retaining a new flow's participants.
	useEffect(() => {
		if (selectedDiagramId && draftParticipants.length === 0) {
			setActiveDiagramId(selectedDiagramId);
		}
	}, [selectedDiagramId, draftParticipants.length]);

	const activeDiagram =
		diagrams.find((diagram) => diagram.id === activeDiagramId) ?? null;
	const participants = activeDiagram?.participants ?? draftParticipants;
	const steps = activeDiagram?.messages ?? [];
	const participantById = new Map(
		participants.map((participant) => [participant.id, participant]),
	);
	const diagramId = activeDiagram?.id ?? null;
	const previousDiagramId = useRef(diagramId);

	useEffect(() => {
		if (previousDiagramId.current === diagramId) return;
		previousDiagramId.current = diagramId;
		setEditingEventIndex(null);
		setStepForm(EMPTY_FORM);
		setStructureOpen(false);
		setAddingParticipant(false);
		setParticipantLabel("");
		setStructureLabel("");
	}, [diagramId]);

	const fromParticipantId = participantById.has(stepForm.fromParticipantId)
		? stepForm.fromParticipantId
		: (participants[0]?.id ?? "");
	const toParticipantId =
		stepForm.kind === "self"
			? fromParticipantId
			: participantById.has(stepForm.toParticipantId)
				? stepForm.toParticipantId
				: (participants[1]?.id ?? participants[0]?.id ?? "");
	const resolvedForm = { ...stepForm, fromParticipantId, toParticipantId };
	const editingStep = steps.find(
		(step) => step.eventIndex === editingEventIndex,
	);
	const canSave = Boolean(
		fromParticipantId &&
			toParticipantId &&
			stepForm.label.trim() &&
			(editingEventIndex === null
				? !activeDiagram || onAddMessage
				: editingStep && onUpdateMessage),
	);

	const parsed = useMemo(() => parseSequenceDiagram(source), [source]);
	const errors = parsed.diagnostics.filter(
		(diagnostic) => diagnostic.severity === "error",
	);
	const warnings = parsed.diagnostics.filter(
		(diagnostic) => diagnostic.severity === "warning",
	);
	const messageCount = parsed.document.events.filter(
		(event) => event.type === "message",
	).length;
	const canInsertMermaid =
		errors.length === 0 && parsed.document.participants.length > 0;

	const insertDiagram = (diagramSource: string) => {
		const insertedId = onInsert(diagramSource);
		setDraftParticipants([]);
		if (insertedId) setActiveDiagramId(insertedId);
		setDescriptionOpen(false);
		setRecognitionNote(null);
		setActiveTab("builder");
	};

	const addParticipant = () => {
		const label = participantLabel.trim();
		if (!label) return;
		if (activeDiagram) {
			onAddParticipant?.(activeDiagram.id, { label, kind: participantKind });
		} else {
			const id = `draft-participant-${++nextParticipant.current}`;
			setDraftParticipants((current) => [
				...current,
				{ id, label, kind: participantKind },
			]);
		}
		setParticipantLabel("");
		setAddingParticipant(false);
	};

	const focusComposer = () => {
		composerRef.current?.scrollIntoView({ block: "nearest" });
		actionInput.current?.focus();
	};

	const saveStep = () => {
		if (!canSave) return;
		const input = { ...resolvedForm, label: resolvedForm.label.trim() };
		if (activeDiagram) {
			if (editingEventIndex !== null) {
				onUpdateMessage?.(activeDiagram.id, {
					...input,
					eventIndex: editingEventIndex,
				});
			} else {
				onAddMessage?.(activeDiagram.id, input);
			}
		} else {
			insertDiagram(
				buildSequenceDiagramSource(
					participants,
					[{ id: "first-step", ...input }],
					t("sequenceDiagramPanel.defaultTitle", "Ablauf"),
				),
			);
		}
		setEditingEventIndex(null);
		setStepForm({ ...resolvedForm, label: "", kind: "synchronous" });
		actionInput.current?.focus();
	};

	const recognizeDescription = () => {
		const recognized = recognizeSequenceDescription(description);
		if (recognized.steps.length === 0) {
			setRecognitionNote(
				t(
					"sequenceDiagramPanel.recognitionEmpty",
					"Ich konnte noch keinen klaren Schritt erkennen. Nenne am besten, wer etwas an wen sendet.",
				),
			);
			return;
		}
		insertDiagram(
			buildSequenceDiagramSource(
				recognized.participants,
				recognized.steps,
				t("sequenceDiagramPanel.defaultTitle", "Ablauf"),
			),
		);
	};

	return (
		<aside
			ref={floatingPanel.panelRef}
			className={["canvas-editor__sequence-panel", className]
				.filter(Boolean)
				.join(" ")}
			style={{ ...style, ...floatingPanel.panelStyle }}
			aria-label={t("sequenceDiagramPanel.title", "Sequenzdiagramm")}
		>
			<header
				className="canvas-editor__panel-header"
				{...floatingPanel.dragHandleProps}
			>
				{activeTab === "mermaid" ? (
					<button
						type="button"
						className="canvas-editor__panel-icon-button"
						onClick={() => setActiveTab("builder")}
						aria-label={t("common.back", "Zurück")}
					>
						<ArrowLeft />
					</button>
				) : (
					<Workflow className="canvas-editor__panel-title-icon" />
				)}
				<div className="canvas-editor__panel-heading">
					<h3 className="canvas-editor__panel-title">
						{activeTab === "mermaid"
							? t("sequenceDiagramPanel.advanced", "Erweitert")
							: t("sequenceDiagramPanel.builderTitle", "Ablauf erstellen")}
					</h3>
					<p className="canvas-editor__panel-subtitle">
						{activeTab === "mermaid"
							? t(
									"sequenceDiagramPanel.advancedSubtitle",
									"Mermaid-Code direkt einfügen",
								)
							: t(
									"sequenceDiagramPanel.builderSubtitle",
									"Beteiligte festlegen und Schritt für Schritt verbinden.",
								)}
					</p>
				</div>
				{activeTab === "mermaid" && (
					<button
						type="button"
						className="canvas-editor__panel-icon-button"
						onClick={() => setSource(defaultSource)}
						aria-label={t(
							"sequenceDiagramPanel.reset",
							"Beispiel zurücksetzen",
						)}
					>
						<RotateCcw />
					</button>
				)}
				{onClose && (
					<button
						type="button"
						className="canvas-editor__panel-icon-button"
						onClick={onClose}
						aria-label={t("common.close", "Schließen")}
					>
						<X />
					</button>
				)}
			</header>
			{activeTab === "builder" ? (
				<>
					<div className="canvas-editor__sequence-body canvas-editor__sequence-builder-body">
						<section className="canvas-editor__sequence-participants-section">
							<div className="canvas-editor__sequence-steps-heading">
								<h4>
									{t("sequenceDiagramPanel.participantsHeading", "Beteiligte")}
								</h4>
							</div>
							{participants.length === 0 && (
								<p className="canvas-editor__sequence-help">
									{t(
										"sequenceDiagramPanel.participantsHint",
										"Wer ist beteiligt? Füge Personen oder Systeme hinzu.",
									)}
								</p>
							)}
							<div className="canvas-editor__sequence-participant-chips">
								{participants.map((participant) => (
									<span key={participant.id}>
										{participant.kind === "actor" ? <UserRound /> : <Box />}
										{participant.label}
									</span>
								))}
								{!addingParticipant && participants.length > 0 && (
									<button
										type="button"
										onClick={() => setAddingParticipant(true)}
										disabled={Boolean(activeDiagram && !onAddParticipant)}
									>
										<Plus />
										{t(
											"sequenceDiagramPanel.addParticipant",
											"Beteiligten hinzufügen",
										)}
									</button>
								)}
							</div>
							{(addingParticipant || participants.length === 0) && (
								<form
									className="canvas-editor__sequence-participant-form"
									onSubmit={(event) => {
										event.preventDefault();
										addParticipant();
									}}
								>
									<select
										value={participantKind}
										aria-label={t(
											"sequenceDiagramPanel.participantType",
											"Art des Beteiligten",
										)}
										onChange={(event) =>
											setParticipantKind(
												event.target.value as "actor" | "participant",
											)
										}
									>
										<option value="participant">
											{t("sequenceDiagramPanel.system", "System")}
										</option>
										<option value="actor">
											{t("sequenceDiagramPanel.person", "Person")}
										</option>
									</select>
									<input
										value={participantLabel}
										onChange={(event) =>
											setParticipantLabel(event.target.value)
										}
										aria-label={t(
											"sequenceDiagramPanel.participantName",
											"Name des Beteiligten",
										)}
										placeholder={t(
											"sequenceDiagramPanel.participantPlaceholder",
											"z. B. Kunde oder Service",
										)}
									/>
									<button
										type="submit"
										disabled={
											!participantLabel.trim() ||
											Boolean(activeDiagram && !onAddParticipant)
										}
										aria-label={t(
											"sequenceDiagramPanel.addParticipant",
											"Beteiligten hinzufügen",
										)}
									>
										<Check />
									</button>
								</form>
							)}
						</section>
						<section className="canvas-editor__sequence-steps-section">
							<div className="canvas-editor__sequence-steps-heading">
								<h4>{t("sequenceDiagramPanel.steps", "Schritte")}</h4>
								<strong>{steps.length}</strong>
							</div>
							{steps.length > 0 && (
								<ol className="canvas-editor__sequence-step-list">
									{steps.map((step, index) => (
										<li
											key={step.eventIndex}
											data-editing={editingEventIndex === step.eventIndex}
										>
											<div className="canvas-editor__sequence-step-order">
												<button
													type="button"
													disabled={!onMoveMessage || index === 0}
													aria-label={t(
														"sequenceDiagramPanel.moveUp",
														"Schritt nach oben",
													)}
													title={t(
														"sequenceDiagramPanel.moveUp",
														"Schritt nach oben",
													)}
													onClick={() =>
														activeDiagram &&
														onMoveMessage?.(
															activeDiagram.id,
															step.eventIndex,
															"up",
														)
													}
												>
													<ArrowUp />
												</button>
												<span className="canvas-editor__sequence-step-number">
													{index + 1}
												</span>
												<button
													type="button"
													disabled={
														!onMoveMessage || index === steps.length - 1
													}
													aria-label={t(
														"sequenceDiagramPanel.moveDown",
														"Schritt nach unten",
													)}
													title={t(
														"sequenceDiagramPanel.moveDown",
														"Schritt nach unten",
													)}
													onClick={() =>
														activeDiagram &&
														onMoveMessage?.(
															activeDiagram.id,
															step.eventIndex,
															"down",
														)
													}
												>
													<ArrowDown />
												</button>
											</div>
											<div className="canvas-editor__sequence-step-sentence">
												<span
													title={
														participantById.get(step.fromParticipantId)?.label
													}
												>
													{participantById.get(step.fromParticipantId)?.label ??
														"?"}
												</span>
												<ArrowRight aria-hidden="true" />
												<span
													title={
														participantById.get(step.toParticipantId)?.label
													}
												>
													{participantById.get(step.toParticipantId)?.label ??
														"?"}
												</span>
												<strong title={step.label}>
													{step.kind === "return" && (
														<small>
															{t("sequenceDiagramPanel.answer", "Antwort")}:{" "}
														</small>
													)}
													{step.label}
												</strong>
											</div>
											<div className="canvas-editor__sequence-step-actions">
												<button
													type="button"
													disabled={!onAddMessage}
													aria-label={t(
														"sequenceDiagramPanel.replyToStep",
														"Antwort hinzufügen",
													)}
													title={t(
														"sequenceDiagramPanel.replyToStep",
														"Antwort hinzufügen",
													)}
													onClick={() => {
														setEditingEventIndex(null);
														setStepForm({
															fromParticipantId: step.toParticipantId,
															toParticipantId: step.fromParticipantId,
															label: "",
															kind: "return",
														});
														focusComposer();
													}}
												>
													<ArrowLeft />
												</button>
												<button
													type="button"
													disabled={!onUpdateMessage}
													aria-label={t("common.edit", "Bearbeiten")}
													title={t("common.edit", "Bearbeiten")}
													onClick={() => {
														setEditingEventIndex(step.eventIndex);
														setStepForm({
															fromParticipantId: step.fromParticipantId,
															toParticipantId: step.toParticipantId,
															label: step.label,
															kind: step.kind,
														});
														focusComposer();
													}}
												>
													<Pencil />
												</button>
												<button
													type="button"
													disabled={!onDeleteMessage}
													aria-label={t("common.delete", "Löschen")}
													title={t("common.delete", "Löschen")}
													onClick={() => {
														if (activeDiagram)
															onDeleteMessage?.(
																activeDiagram.id,
																step.eventIndex,
															);
														if (editingEventIndex === step.eventIndex) {
															setEditingEventIndex(null);
															setStepForm(EMPTY_FORM);
														}
													}}
												>
													<Trash2 />
												</button>
											</div>
										</li>
									))}
								</ol>
							)}
							{participants.length === 0 ? (
								<p className="canvas-editor__sequence-help">
									{t(
										"sequenceDiagramPanel.builderEmpty",
										"Lege zuerst die Beteiligten an. Danach kannst du sie mit Schritten verbinden.",
									)}
								</p>
							) : (
								<form
									ref={composerRef}
									className="canvas-editor__sequence-panel-composer"
									onSubmit={(event) => {
										event.preventDefault();
										saveStep();
									}}
								>
									<strong className="canvas-editor__sequence-composer-title">
										{editingEventIndex !== null
											? t("sequenceDiagramPanel.editStep", "Schritt bearbeiten")
											: stepForm.kind === "return"
												? t(
														"sequenceDiagramPanel.replyToStep",
														"Antwort hinzufügen",
													)
												: t(
														"sequenceDiagramPanel.nextStep",
														"Nächster Schritt",
													)}
									</strong>
									<div className="canvas-editor__sequence-sentence-composer">
										<select
											value={fromParticipantId}
											aria-label={t("sequenceDiagramPanel.from", "Von")}
											onChange={(event) =>
												setStepForm({
													...resolvedForm,
													fromParticipantId: event.target.value,
												})
											}
										>
											{participants.map((participant) => (
												<option key={participant.id} value={participant.id}>
													{participant.label}
												</option>
											))}
										</select>
										<ArrowRight aria-hidden="true" />
										<select
											value={toParticipantId}
											disabled={stepForm.kind === "self"}
											aria-label={t("sequenceDiagramPanel.to", "An")}
											onChange={(event) =>
												setStepForm({
													...resolvedForm,
													toParticipantId: event.target.value,
												})
											}
										>
											{participants.map((participant) => (
												<option key={participant.id} value={participant.id}>
													{participant.label}
												</option>
											))}
										</select>
										<input
											ref={actionInput}
											value={stepForm.label}
											onChange={(event) =>
												setStepForm({
													...resolvedForm,
													label: event.target.value,
												})
											}
											aria-label={t("sequenceDiagramPanel.action", "Aktion")}
											placeholder={t(
												"sequenceDiagramPanel.actionPlaceholder",
												"Was passiert?",
											)}
										/>
									</div>
									<div className="canvas-editor__sequence-panel-composer-actions">
										<button type="submit" disabled={!canSave}>
											{editingEventIndex !== null ? <Check /> : <Plus />}
											{editingEventIndex !== null
												? t("common.save", "Speichern")
												: stepForm.kind === "return"
													? t(
															"sequenceDiagramPanel.replyToStep",
															"Antwort hinzufügen",
														)
													: t(
															"sequenceDiagramPanel.addStep",
															"Schritt hinzufügen",
														)}
										</button>
										{(editingEventIndex !== null ||
											stepForm.kind === "return") && (
											<button
												type="button"
												onClick={() => {
													setEditingEventIndex(null);
													setStepForm(EMPTY_FORM);
												}}
											>
												{t("common.cancel", "Abbrechen")}
											</button>
										)}
									</div>
								</form>
							)}
							{activeDiagram && (
								<>
									{activeDiagram.fragments.length > 0 && (
										<section className="canvas-editor__sequence-fragments">
											<h4>
												{t(
													"sequenceDiagramPanel.fragmentsHeading",
													"Bedingungen & Wiederholungen",
												)}
											</h4>
											<ul>
												{activeDiagram.fragments.map((fragment) => (
													<li key={fragment.elementId}>
														<GitBranch aria-hidden="true" />
														<span>{fragment.label}</span>
														<button
															type="button"
															disabled={!onDeleteFragment}
															aria-label={`${t("sequenceDiagramPanel.deleteFragment", "Abschnitt löschen")}: ${fragment.label}`}
															title={t(
																"sequenceDiagramPanel.deleteFragment",
																"Abschnitt löschen",
															)}
															onClick={() =>
																onDeleteFragment?.(
																	activeDiagram.id,
																	fragment.eventIndex,
																)
															}
														>
															<Trash2 />
														</button>
													</li>
												))}
											</ul>
										</section>
									)}
									<p className="canvas-editor__sequence-help">
										{t(
											"sequenceDiagramPanel.liveHint",
											"Änderungen erscheinen direkt im Diagramm.",
										)}
									</p>
									<div className="canvas-editor__sequence-structure-disclosure">
										<button
											type="button"
											onClick={() => setStructureOpen((open) => !open)}
											aria-expanded={structureOpen}
										>
											<GitBranch />
											{t(
												"sequenceDiagramPanel.moreOptions",
												"Weitere Optionen",
											)}
											{structureOpen ? <ChevronDown /> : <ChevronRight />}
										</button>
										{structureOpen && (
											<>
												<p className="canvas-editor__sequence-help">
													{t(
														"sequenceDiagramPanel.wrapHint",
														"Bedingung oder Wiederholung um den gesamten Ablauf legen.",
													)}
												</p>
												<form
													onSubmit={(event) => {
														event.preventDefault();
														if (!onAddFragment) return;
														onAddFragment(activeDiagram.id, {
															kind: structureKind === "repeat" ? "loop" : "alt",
															label:
																structureLabel.trim() ||
																(structureKind === "repeat"
																	? t(
																			"sequenceDiagramPanel.repeat",
																			"Wiederholung",
																		)
																	: t(
																			"sequenceDiagramPanel.condition",
																			"Bedingung",
																		)),
														});
														setStructureLabel("");
														setStructureOpen(false);
													}}
												>
													<select
														value={structureKind}
														aria-label={t(
															"sequenceDiagramPanel.structureType",
															"Art des Abschnitts",
														)}
														onChange={(event) =>
															setStructureKind(
																event.target.value as "condition" | "repeat",
															)
														}
													>
														<option value="condition">
															{t("sequenceDiagramPanel.condition", "Bedingung")}
														</option>
														<option value="repeat">
															{t("sequenceDiagramPanel.repeat", "Wiederholung")}
														</option>
													</select>
													<input
														value={structureLabel}
														onChange={(event) =>
															setStructureLabel(event.target.value)
														}
														aria-label={t(
															"sequenceDiagramPanel.structureLabel",
															"Beschreibung des Abschnitts",
														)}
														placeholder={
															structureKind === "repeat"
																? t(
																		"sequenceDiagramPanel.repeatPlaceholder",
																		"Solange ...",
																	)
																: t(
																		"sequenceDiagramPanel.conditionPlaceholder",
																		"Wenn ...",
																	)
														}
													/>
													<button type="submit" disabled={!onAddFragment}>
														<Plus />
														{t("sequenceDiagramPanel.add", "Hinzufügen")}
													</button>
												</form>
											</>
										)}
									</div>
								</>
							)}
						</section>
						{!activeDiagram && participants.length === 0 && (
							<section className="canvas-editor__sequence-description">
								<button
									type="button"
									className="canvas-editor__sequence-advanced-link"
									onClick={() => setDescriptionOpen((open) => !open)}
									aria-expanded={descriptionOpen}
								>
									<FileText />
									{t(
										"sequenceDiagramPanel.describeOptional",
										"Optional: mit einer Beschreibung starten",
									)}
									{descriptionOpen ? <ChevronDown /> : <ChevronRight />}
								</button>
								{descriptionOpen && (
									<>
										<label htmlFor={descriptionId}>
											{t(
												"sequenceDiagramPanel.describeLabel",
												"Ablauf kurz beschreiben",
											)}
										</label>
										<textarea
											id={descriptionId}
											value={description}
											rows={3}
											placeholder={t(
												"sequenceDiagramPanel.descriptionExample",
												"Ein Kunde sendet eine Bestellung.\nDer Service prüft die Daten über die API.",
											)}
											onChange={(event) => setDescription(event.target.value)}
										/>
										<p className="canvas-editor__sequence-help">
											{t(
												"sequenceDiagramPanel.descriptionHint",
												"Einfache Sätze mit Kunde, Service, API oder Datenbank werden erkannt. Prüfe danach die Schritte.",
											)}
										</p>
										<div className="canvas-editor__sequence-description-actions">
											<button
												type="button"
												onClick={recognizeDescription}
												disabled={!description.trim()}
											>
												<Plus />
												{t(
													"sequenceDiagramPanel.createFromDescription",
													"Ablauf erstellen",
												)}
											</button>
										</div>
										{recognitionNote && (
											<output className="canvas-editor__sequence-help">
												{recognitionNote}
											</output>
										)}
									</>
								)}
							</section>
						)}
					</div>
					<footer className="canvas-editor__sequence-builder-footer">
						{activeDiagram && onClose && (
							<button
								type="button"
								className="canvas-editor__sequence-insert"
								onClick={onClose}
							>
								<Check />
								{t("sequenceDiagramPanel.done", "Fertig")}
							</button>
						)}
						<button
							type="button"
							className="canvas-editor__sequence-advanced-link"
							onClick={() => setActiveTab("mermaid")}
						>
							{t("sequenceDiagramPanel.advanced", "Erweitert")}
							<ChevronRight />
						</button>
					</footer>
				</>
			) : (
				<>
					<div className="canvas-editor__sequence-body">
						<label className="canvas-editor__sequence-source-label">
							<span>
								{t("sequenceDiagramPanel.source", "Mermaid-Sequenzsyntax")}
							</span>
							<textarea
								value={source}
								onChange={(event) => setSource(event.target.value)}
								className="canvas-editor__sequence-source"
								spellCheck={false}
								aria-describedby="canvas-editor-sequence-hint"
							/>
						</label>
						<div
							id="canvas-editor-sequence-hint"
							className="canvas-editor__sequence-hint"
						>
							<code>A-&gt;&gt;B: Request</code>
							<code>B--&gt;&gt;A: Return</code>
							<code>alt / else / end</code>
						</div>
						<div
							className="canvas-editor__sequence-status"
							data-valid={canInsertMermaid}
						>
							{canInsertMermaid ? <CheckCircle2 /> : <AlertCircle />}
							<span>
								{canInsertMermaid
									? t("sequenceDiagramPanel.valid", "Diagramm ist bereit")
									: t(
											"sequenceDiagramPanel.invalid",
											"Korrigiere vor dem Einfügen die Syntax",
										)}
							</span>
							{canInsertMermaid && (
								<span className="canvas-editor__sequence-counts">
									{parsed.document.participants.length} · {messageCount}
								</span>
							)}
						</div>
						{parsed.diagnostics.length > 0 && (
							<ul className="canvas-editor__sequence-diagnostics">
								{[...errors, ...warnings].slice(0, 5).map((diagnostic) => (
									<li
										key={`${diagnostic.line}-${diagnostic.code}`}
										data-severity={diagnostic.severity}
									>
										<strong>
											{t("sequenceDiagramPanel.line", "Zeile")}{" "}
											{diagnostic.line}:
										</strong>{" "}
										{diagnostic.message}
									</li>
								))}
							</ul>
						)}
					</div>
					<footer className="canvas-editor__sequence-footer">
						<button
							type="button"
							className="canvas-editor__sequence-insert"
							disabled={!canInsertMermaid}
							onClick={() => insertDiagram(source)}
						>
							<Workflow />
							{t("sequenceDiagramPanel.insert", "Diagramm einfügen")}
						</button>
					</footer>
				</>
			)}
		</aside>
	);
}
