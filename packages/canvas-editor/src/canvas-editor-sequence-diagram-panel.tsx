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
	ArrowLeft,
	ArrowRight,
	Box,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileText,
	GitBranch,
	GripVertical,
	Pencil,
	Plus,
	Repeat2,
	RotateCcw,
	Trash2,
	UserRound,
	Workflow,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type SequenceBuilderParticipant,
	type SequenceBuilderStep,
	type SequenceBuilderStructure,
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
	onAddActivation?: (diagramId: string, participantId: string) => void;
	onAddFragment?: (
		diagramId: string,
		input: { kind: SequenceVisualFragmentKind; label: string },
	) => void;
	onInsert: (source: string) => void;
	onClose?: () => void;
}

type SequencePanelTab = "builder" | "mermaid";

interface SequenceStepView {
	key: string;
	eventIndex: number | null;
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
}

interface SequenceStepForm {
	fromParticipantId: string;
	toParticipantId: string;
	label: string;
	kind: SequenceVisualMessageKind;
}

const fallbackTranslate: CanvasEditorSequenceDiagramTranslate = (
	_key,
	fallback,
) => fallback;

const EMPTY_ELEMENTS = new Map<string, CanvasElement>();

function joinClasses(...values: Array<string | false | null | undefined>) {
	return values.filter(Boolean).join(" ");
}

function makeDraftParticipantId(label: string, index: number) {
	const slug =
		label
			.normalize("NFKD")
			.replace(/\p{M}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "participant";
	return `draft-${slug}-${index + 1}`;
}

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
	onAddFragment,
	onInsert,
	onClose,
}: CanvasEditorSequenceDiagramPanelProps) {
	const floatingPanel = useCanvasEditorFloatingPanel();
	const nextDraftStep = useRef(1);
	const [activeTab, setActiveTab] = useState<SequencePanelTab>(
		defaultTab === "mermaid" ? "mermaid" : "builder",
	);
	const [source, setSource] = useState(defaultSource);
	const [description, setDescription] = useState(() =>
		t(
			"sequenceDiagramPanel.descriptionExample",
			"Ein Kunde sendet eine Bestellung.\nDer Service prüft die Daten über die API.",
		),
	);
	const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
	const [draftParticipants, setDraftParticipants] = useState<
		SequenceBuilderParticipant[]
	>([]);
	const [draftSteps, setDraftSteps] = useState<SequenceBuilderStep[]>([]);
	const [draftStructure, setDraftStructure] =
		useState<SequenceBuilderStructure | null>(null);
	const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
	const [addingParticipant, setAddingParticipant] = useState(false);
	const [participantLabel, setParticipantLabel] = useState("");
	const [participantKind, setParticipantKind] = useState<
		"actor" | "participant"
	>("participant");
	const [editingStepKey, setEditingStepKey] = useState<string | null>(null);
	const [stepForm, setStepForm] = useState<SequenceStepForm>({
		fromParticipantId: "",
		toParticipantId: "",
		label: "",
		kind: "synchronous",
	});
	const [addingStep, setAddingStep] = useState(false);
	const [structureOpen, setStructureOpen] = useState(false);
	const [structureKind, setStructureKind] =
		useState<SequenceBuilderStructure["kind"]>("condition");
	const [structureLabel, setStructureLabel] = useState("");
	const [quickOpen, setQuickOpen] = useState(true);
	const [quickForm, setQuickForm] = useState<SequenceStepForm>({
		fromParticipantId: "",
		toParticipantId: "",
		label: "",
		kind: "synchronous",
	});

	const diagrams = useMemo(
		() => getSequenceDiagramSummaries(elements.values()),
		[elements],
	);
	const selectedDiagramId = useMemo(
		() =>
			selectedElements
				.map(getSequenceDiagramId)
				.find((diagramId): diagramId is string => Boolean(diagramId)) ?? null,
		[selectedElements],
	);
	const hasDraft = draftParticipants.length > 0 || draftSteps.length > 0;

	useEffect(() => {
		if (hasDraft) return;
		if (selectedDiagramId) {
			setActiveDiagramId(selectedDiagramId);
			setQuickOpen(true);
			return;
		}
		if (!diagrams.some((diagram) => diagram.id === activeDiagramId)) {
			setActiveDiagramId(null);
		}
	}, [activeDiagramId, diagrams, hasDraft, selectedDiagramId]);

	const activeDiagram = hasDraft
		? null
		: (diagrams.find((diagram) => diagram.id === activeDiagramId) ?? null);
	const participants: SequenceBuilderParticipant[] = hasDraft
		? draftParticipants
		: (activeDiagram?.participants.map(({ id, label, kind }) => ({
				id,
				label,
				kind,
			})) ?? []);
	const steps: SequenceStepView[] = hasDraft
		? draftSteps.map((step) => ({
				...step,
				key: step.id,
				eventIndex: null,
			}))
		: (activeDiagram?.messages.map((message) => ({
				key: `event-${message.eventIndex}`,
				eventIndex: message.eventIndex,
				fromParticipantId: message.fromParticipantId,
				toParticipantId: message.toParticipantId,
				label: message.label,
				kind: message.kind,
			})) ?? []);
	const participantById = new Map(
		participants.map((participant) => [participant.id, participant]),
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

	const resolvedForm = (form: SequenceStepForm): SequenceStepForm => {
		const fromParticipantId = participants.some(
			(participant) => participant.id === form.fromParticipantId,
		)
			? form.fromParticipantId
			: (participants[0]?.id ?? "");
		const toParticipantId = participants.some(
			(participant) => participant.id === form.toParticipantId,
		)
			? form.toParticipantId
			: (participants[1]?.id ?? participants[0]?.id ?? "");
		return { ...form, fromParticipantId, toParticipantId };
	};
	const resolvedStepForm = resolvedForm(stepForm);
	const resolvedQuickForm = resolvedForm(quickForm);

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
		setActiveDiagramId(null);
		setDraftParticipants(recognized.participants);
		setDraftSteps(recognized.steps);
		setDraftStructure(null);
		setRecognitionNote(
			t(
				"sequenceDiagramPanel.recognitionSuccess",
				"Ablauf erkannt – du kannst jeden Schritt noch anpassen.",
			),
		);
	};

	const addParticipant = () => {
		const label = participantLabel.trim();
		if (!label) return;
		if (hasDraft || !activeDiagram) {
			setDraftParticipants((current) => [
				...current,
				{
					id: makeDraftParticipantId(label, current.length),
					label,
					kind: participantKind,
				},
			]);
		} else {
			onAddParticipant?.(activeDiagram.id, { label, kind: participantKind });
		}
		setParticipantLabel("");
		setAddingParticipant(false);
	};

	const beginStepEdit = (step: SequenceStepView) => {
		setEditingStepKey(step.key);
		setStepForm({
			fromParticipantId: step.fromParticipantId,
			toParticipantId: step.toParticipantId,
			label: step.label,
			kind: step.kind,
		});
	};

	const saveStepEdit = (step: SequenceStepView) => {
		const form = resolvedStepForm;
		if (
			!form.fromParticipantId ||
			!form.toParticipantId ||
			!form.label.trim()
		) {
			return;
		}
		if (step.eventIndex === null) {
			setDraftSteps((current) =>
				current.map((draft) =>
					draft.id === step.key
						? { ...draft, ...form, label: form.label.trim() }
						: draft,
				),
			);
		} else if (activeDiagram) {
			onUpdateMessage?.(activeDiagram.id, {
				eventIndex: step.eventIndex,
				...form,
				label: form.label.trim(),
			});
		}
		setEditingStepKey(null);
	};

	const deleteStep = (step: SequenceStepView) => {
		if (step.eventIndex === null) {
			setDraftSteps((current) =>
				current.filter((draft) => draft.id !== step.key),
			);
		} else if (activeDiagram) {
			onDeleteMessage?.(activeDiagram.id, step.eventIndex);
		}
		if (editingStepKey === step.key) setEditingStepKey(null);
	};

	const addStepFromForm = (form: SequenceStepForm) => {
		const resolved = resolvedForm(form);
		if (
			!resolved.fromParticipantId ||
			!resolved.toParticipantId ||
			!resolved.label.trim()
		) {
			return false;
		}
		if (activeDiagram) {
			onAddMessage?.(activeDiagram.id, {
				...resolved,
				label: resolved.label.trim(),
			});
		} else {
			const id = `draft-step-${nextDraftStep.current++}`;
			setDraftSteps((current) => [
				...current,
				{ id, ...resolved, label: resolved.label.trim() },
			]);
		}
		return true;
	};

	const addStructure = () => {
		const label =
			structureLabel.trim() ||
			(structureKind === "repeat"
				? t("sequenceDiagramPanel.repeat", "Wiederholung")
				: t("sequenceDiagramPanel.condition", "Bedingung"));
		if (activeDiagram) {
			onAddFragment?.(activeDiagram.id, {
				kind: structureKind === "repeat" ? "loop" : "alt",
				label,
			});
		} else {
			setDraftStructure({ kind: structureKind, label });
		}
		setStructureOpen(false);
		setStructureLabel("");
	};

	const insertDraft = () => {
		if (draftParticipants.length === 0 || draftSteps.length === 0) return;
		onInsert(
			buildSequenceDiagramSource(
				draftParticipants,
				draftSteps,
				t("sequenceDiagramPanel.defaultTitle", "Ablauf"),
				draftStructure,
			),
		);
		setDraftParticipants([]);
		setDraftSteps([]);
		setDraftStructure(null);
		setRecognitionNote(null);
	};

	const renderStepComposer = (
		form: SequenceStepForm,
		onChange: (next: SequenceStepForm) => void,
		options: { quick?: boolean } = {},
	) => {
		const resolved = resolvedForm(form);
		return (
			<div
				className={joinClasses(
					"canvas-editor__sequence-sentence-composer",
					options.quick && "canvas-editor__sequence-sentence-composer--quick",
				)}
			>
				<select
					value={resolved.fromParticipantId}
					onChange={(event) =>
						onChange({ ...resolved, fromParticipantId: event.target.value })
					}
					aria-label={t("sequenceDiagramPanel.from", "Von")}
				>
					{participants.map((participant) => (
						<option key={participant.id} value={participant.id}>
							{participant.label}
						</option>
					))}
				</select>
				<ArrowRight aria-hidden="true" />
				<select
					value={
						resolved.kind === "self"
							? resolved.fromParticipantId
							: resolved.toParticipantId
					}
					onChange={(event) =>
						onChange({ ...resolved, toParticipantId: event.target.value })
					}
					disabled={resolved.kind === "self"}
					aria-label={t("sequenceDiagramPanel.to", "An")}
				>
					{participants.map((participant) => (
						<option key={participant.id} value={participant.id}>
							{participant.label}
						</option>
					))}
				</select>
				<input
					value={resolved.label}
					onChange={(event) =>
						onChange({ ...resolved, label: event.target.value })
					}
					aria-label={t("sequenceDiagramPanel.action", "Aktion")}
					placeholder={t(
						"sequenceDiagramPanel.actionPlaceholder",
						"Was passiert?",
					)}
				/>
			</div>
		);
	};

	return (
		<>
			<aside
				ref={floatingPanel.panelRef}
				className={joinClasses("canvas-editor__sequence-panel", className)}
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
										"Beschreibe, was passiert – Skedra zeichnet den Rest.",
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
							title={t("sequenceDiagramPanel.reset", "Beispiel zurücksetzen")}
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
							<section className="canvas-editor__sequence-description">
								<label htmlFor="canvas-editor-sequence-description">
									{t(
										"sequenceDiagramPanel.describeLabel",
										"Ablauf kurz beschreiben",
									)}
								</label>
								<textarea
									id="canvas-editor-sequence-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									rows={3}
								/>
								<div className="canvas-editor__sequence-description-actions">
									<button
										type="button"
										onClick={recognizeDescription}
										disabled={!description.trim()}
									>
										<FileText />
										{t("sequenceDiagramPanel.recognize", "Schritte erkennen")}
									</button>
									{recognitionNote && <span>{recognitionNote}</span>}
								</div>
							</section>

							<section className="canvas-editor__sequence-participants-section">
								<div className="canvas-editor__sequence-participant-chips">
									{participants.map((participant) => (
										<span key={participant.id}>
											{participant.kind === "actor" ? <UserRound /> : <Box />}
											{participant.label}
										</span>
									))}
									<button
										type="button"
										onClick={() => setAddingParticipant((value) => !value)}
										aria-expanded={addingParticipant}
									>
										<Plus />
										{t("sequenceDiagramPanel.addParticipant", "Beteiligte")}
									</button>
								</div>
								{addingParticipant && (
									<div className="canvas-editor__sequence-participant-form">
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
											<option value="actor">
												{t("sequenceDiagramPanel.person", "Person")}
											</option>
											<option value="participant">
												{t("sequenceDiagramPanel.system", "System")}
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
											placeholder={t("sequenceDiagramPanel.name", "Name")}
											onKeyDown={(event) => {
												if (event.key === "Enter") addParticipant();
											}}
										/>
										<button
											type="button"
											onClick={addParticipant}
											disabled={!participantLabel.trim()}
											aria-label={t(
												"sequenceDiagramPanel.addParticipant",
												"Beteiligten hinzufügen",
											)}
										>
											<Check />
										</button>
									</div>
								)}
							</section>

							<section className="canvas-editor__sequence-steps-section">
								<div className="canvas-editor__sequence-steps-heading">
									<div>
										<h4>{t("sequenceDiagramPanel.steps", "Schritte")}</h4>
										{activeDiagram && (
											<span>
												{t(
													"sequenceDiagramPanel.selectedDiagram",
													"Ausgewähltes Diagramm",
												)}
											</span>
										)}
									</div>
									<strong>{steps.length}</strong>
								</div>

								{steps.length === 0 ? (
									<div className="canvas-editor__sequence-builder-empty">
										<Workflow />
										<p>
											{t(
												"sequenceDiagramPanel.builderEmpty",
												"Beschreibe den Ablauf oben oder füge den ersten Schritt selbst hinzu.",
											)}
										</p>
									</div>
								) : (
									<ol className="canvas-editor__sequence-step-list">
										{steps.map((step, index) => {
											const editing = editingStepKey === step.key;
											return (
												<li key={step.key} data-editing={editing}>
													<GripVertical aria-hidden="true" />
													<span className="canvas-editor__sequence-step-number">
														{index + 1}
													</span>
													{editing ? (
														<div className="canvas-editor__sequence-step-edit">
															{renderStepComposer(stepForm, setStepForm)}
															<div className="canvas-editor__sequence-step-edit-actions">
																<button
																	type="button"
																	onClick={() => saveStepEdit(step)}
																	aria-label={t("common.save", "Speichern")}
																>
																	<Check />
																</button>
																<button
																	type="button"
																	onClick={() => setEditingStepKey(null)}
																	aria-label={t("common.cancel", "Abbrechen")}
																>
																	<X />
																</button>
															</div>
														</div>
													) : (
														<>
															<div className="canvas-editor__sequence-step-sentence">
																<span>
																	{participantById.get(step.fromParticipantId)
																		?.label ?? "?"}
																</span>
																<ArrowRight />
																<span>
																	{participantById.get(step.toParticipantId)
																		?.label ?? "?"}
																</span>
																<strong>{step.label}</strong>
															</div>
															<div className="canvas-editor__sequence-step-actions">
																<button
																	type="button"
																	onClick={() => beginStepEdit(step)}
																	aria-label={t("common.edit", "Bearbeiten")}
																>
																	<Pencil />
																</button>
																<button
																	type="button"
																	onClick={() => deleteStep(step)}
																	aria-label={t("common.delete", "Löschen")}
																>
																	<Trash2 />
																</button>
															</div>
														</>
													)}
												</li>
											);
										})}
									</ol>
								)}

								{addingStep ? (
									<div className="canvas-editor__sequence-panel-composer">
										{renderStepComposer(stepForm, setStepForm)}
										<div className="canvas-editor__sequence-panel-composer-actions">
											<button
												type="button"
												onClick={() => {
													if (addStepFromForm(stepForm)) {
														setAddingStep(false);
														setStepForm({ ...stepForm, label: "" });
													}
												}}
											>
												<Plus />
												{t(
													"sequenceDiagramPanel.addStep",
													"Schritt hinzufügen",
												)}
											</button>
											<button
												type="button"
												onClick={() => setAddingStep(false)}
											>
												{t("common.cancel", "Abbrechen")}
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										className="canvas-editor__sequence-add-step"
										onClick={() => {
											setStepForm({
												fromParticipantId: participants[0]?.id ?? "",
												toParticipantId:
													participants[1]?.id ?? participants[0]?.id ?? "",
												label: "",
												kind: "synchronous",
											});
											setAddingStep(true);
										}}
										disabled={participants.length < 1}
									>
										<Plus />
										{t("sequenceDiagramPanel.nextStep", "Nächster Schritt")}
									</button>
								)}

								<div className="canvas-editor__sequence-structure-disclosure">
									<button
										type="button"
										onClick={() => setStructureOpen((value) => !value)}
										aria-expanded={structureOpen}
									>
										<GitBranch />
										{draftStructure
											? `${draftStructure.kind === "repeat" ? t("sequenceDiagramPanel.repeat", "Wiederholung") : t("sequenceDiagramPanel.condition", "Bedingung")}: ${draftStructure.label}`
											: t(
													"sequenceDiagramPanel.addStructure",
													"Bedingung oder Wiederholung",
												)}
										{structureOpen ? <ChevronDown /> : <ChevronRight />}
									</button>
									{structureOpen && (
										<div>
											<select
												value={structureKind}
												aria-label={t(
													"sequenceDiagramPanel.structureType",
													"Art des Abschnitts",
												)}
												onChange={(event) =>
													setStructureKind(
														event.target
															.value as SequenceBuilderStructure["kind"],
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
											<button type="button" onClick={addStructure}>
												<Plus />
												{t("sequenceDiagramPanel.add", "Hinzufügen")}
											</button>
										</div>
									)}
								</div>
							</section>
						</div>

						<footer className="canvas-editor__sequence-builder-footer">
							<button
								type="button"
								className="canvas-editor__sequence-insert"
								disabled={!activeDiagram && draftSteps.length === 0}
								onClick={() => {
									if (activeDiagram) onClose?.();
									else insertDraft();
								}}
							>
								<Workflow />
								{activeDiagram
									? t("sequenceDiagramPanel.done", "Fertig")
									: t("sequenceDiagramPanel.insert", "Diagramm einfügen")}
							</button>
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
								onClick={() => onInsert(source)}
							>
								<Workflow />
								{t("sequenceDiagramPanel.insert", "Diagramm einfügen")}
							</button>
						</footer>
					</>
				)}
			</aside>

			{activeTab === "builder" && activeDiagram && participants.length > 0 && (
				<div className="canvas-editor__sequence-quick-builder">
					{quickOpen ? (
						<div className="canvas-editor__sequence-quick-open-state">
							<div className="canvas-editor__sequence-quick-context">
								<Plus aria-hidden="true" />
								{t(
									"sequenceDiagramPanel.whatNext",
									"Was passiert als Nächstes?",
								)}
							</div>
							<div className="canvas-editor__sequence-quick-popover">
								<div className="canvas-editor__sequence-quick-heading">
									<strong>
										{t("sequenceDiagramPanel.whoDoesWhat", "Wer macht was?")}
									</strong>
									<button
										type="button"
										onClick={() => setQuickOpen(false)}
										aria-label={t("common.close", "Schließen")}
									>
										<X />
									</button>
								</div>
								<div className="canvas-editor__sequence-quick-row">
									{renderStepComposer(quickForm, setQuickForm, { quick: true })}
									<button
										type="button"
										className="canvas-editor__sequence-quick-add"
										onClick={() => {
											if (addStepFromForm(quickForm)) {
												setQuickForm({ ...resolvedQuickForm, label: "" });
											}
										}}
										disabled={!resolvedQuickForm.label.trim()}
									>
										{t("sequenceDiagramPanel.addStep", "Schritt hinzufügen")}
									</button>
								</div>
								<div className="canvas-editor__sequence-quick-options">
									<button
										type="button"
										data-active={resolvedQuickForm.kind === "return"}
										onClick={() =>
											setQuickForm({
												...resolvedQuickForm,
												kind:
													resolvedQuickForm.kind === "return"
														? "synchronous"
														: "return",
											})
										}
									>
										<ArrowLeft />
										{t("sequenceDiagramPanel.answer", "Antwort")}
									</button>
									<button type="button" onClick={() => setStructureOpen(true)}>
										<GitBranch />
										{t("sequenceDiagramPanel.condition", "Bedingung")}
									</button>
									<button
										type="button"
										onClick={() => {
											setStructureKind("repeat");
											setStructureOpen(true);
										}}
									>
										<Repeat2 />
										{t("sequenceDiagramPanel.repeat", "Wiederholung")}
									</button>
								</div>
							</div>
						</div>
					) : (
						<button
							type="button"
							className="canvas-editor__sequence-quick-trigger"
							onClick={() => setQuickOpen(true)}
						>
							<Plus />
							{t("sequenceDiagramPanel.whatNext", "Was passiert als Nächstes?")}
						</button>
					)}
				</div>
			)}
		</>
	);
}
