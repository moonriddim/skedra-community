/** Community adapter for the shared sequence-diagram input surface. */

import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type CanvasMutationPlan,
	applyCanvasMutationPlan,
	createSequenceDiagramElements,
	createVisualSequenceDiagramElements,
	planSequenceDiagramActivationInsertion,
	planSequenceDiagramFragmentInsertion,
	planSequenceDiagramMessageDeletion,
	planSequenceDiagramMessageInsertion,
	planSequenceDiagramMessageUpdate,
	planSequenceDiagramParticipantInsertion,
} from "@skedra/canvas-core";
import {
	CanvasEditorSequenceDiagramPanel,
	expandCanvasEditorAtomicSelectionIds,
} from "@skedra/canvas-editor";
import { useEffect, useRef } from "react";

interface SequenceDiagramPanelProps {
	elements: Map<string, CanvasElement>;
	selectedElements: CanvasElement[];
	onApplyMutationPlan: (plan: CanvasMutationPlan) => void;
	onHistoryBoundary: () => void;
	onSelectIds: (ids: Set<string>) => void;
	onFitElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onClose: () => void;
}

const SEQUENCE_PANEL_CANVAS_OFFSET_X = 240;

export function SequenceDiagramPanel({
	elements,
	selectedElements,
	onApplyMutationPlan,
	onHistoryBoundary,
	onSelectIds,
	onFitElements,
	getViewportCenter,
	onClose,
}: SequenceDiagramPanelProps) {
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const dark = resolvedTheme === "dark";
	const defaults = getCanvasElementFactoryDefaults({ resolvedTheme });
	const appearance = {
		fontFamily: TOOL_FONT_FAMILY,
		participantFill: dark ? "#151d19" : "#ffffff",
		activationFill: dark ? "#1d2823" : "#ffffff",
		noteFill: dark ? "#3f3218" : "#fef3c7",
		noteStroke: dark ? "#fbbf24" : "#d97706",
		noteTextColor: dark ? "#fde68a" : "#713f12",
		lifelineStroke: dark ? "#64748b" : "#94a3b8",
		fragmentStroke: dark ? "#94a3b8" : "#64748b",
		fragmentFill: dark ? "#164e6340" : "#cffafe55",
	};
	const elementsRef = useRef(elements);
	useEffect(() => {
		elementsRef.current = elements;
	}, [elements]);

	const applyMutation = (
		plan: CanvasMutationPlan | null,
		options: { fit?: boolean; close?: boolean } = {},
	) => {
		if (!plan) return;
		onHistoryBoundary();
		try {
			onApplyMutationPlan(plan);
		} finally {
			onHistoryBoundary();
		}
		const applied = applyCanvasMutationPlan(
			Array.from(elementsRef.current.values()),
			plan,
		);
		elementsRef.current = new Map(
			applied.map((element) => [element.id, element]),
		);
		const selectedIds = plan.selectedIds ?? plan.create.map(({ id }) => id);
		onSelectIds(
			expandCanvasEditorAtomicSelectionIds(
				new Set(selectedIds),
				elementsRef.current,
			),
		);
		if (options.fit && plan.create.length > 0) onFitElements(plan.create);
		if (options.close) onClose();
	};

	return (
		<CanvasEditorSequenceDiagramPanel
			elements={elements}
			selectedElements={selectedElements}
			translate={(key, fallback) => {
				const translated = t(key);
				return translated === key ? fallback : translated;
			}}
			onCreateVisualDiagram={(preset) => {
				const center = getViewportCenter();
				const created = createVisualSequenceDiagramElements({
					preset,
					x: center.x + SEQUENCE_PANEL_CANVAS_OFFSET_X,
					y: center.y,
					defaults,
					appearance,
				});
				applyMutation({
					create: created,
					update: [],
					deleteIds: [],
					selectedIds: created.map(({ id }) => id),
				});
			}}
			onAddParticipant={(diagramId, input) =>
				applyMutation(
					planSequenceDiagramParticipantInsertion({
						...input,
						elements: elementsRef.current,
						diagramId,
						defaults,
						appearance,
					}),
				)
			}
			onAddMessage={(diagramId, input) =>
				applyMutation(
					planSequenceDiagramMessageInsertion({
						...input,
						elements: elementsRef.current,
						diagramId,
						defaults,
						appearance,
					}),
				)
			}
			onUpdateMessage={(diagramId, input) =>
				applyMutation(
					planSequenceDiagramMessageUpdate({
						...input,
						elements: elementsRef.current,
						diagramId,
						defaults,
						appearance,
					}),
				)
			}
			onDeleteMessage={(diagramId, eventIndex) =>
				applyMutation(
					planSequenceDiagramMessageDeletion({
						elements: elementsRef.current,
						diagramId,
						eventIndex,
						defaults,
						appearance,
					}),
				)
			}
			onAddActivation={(diagramId, participantId) =>
				applyMutation(
					planSequenceDiagramActivationInsertion({
						participantId,
						elements: elementsRef.current,
						diagramId,
						defaults,
						appearance,
					}),
				)
			}
			onAddFragment={(diagramId, input) =>
				applyMutation(
					planSequenceDiagramFragmentInsertion({
						...input,
						elements: elementsRef.current,
						diagramId,
						defaults,
						appearance,
						wrapCurrentFlow: true,
					}),
				)
			}
			onInsert={(source) => {
				const center = getViewportCenter();
				const created = createSequenceDiagramElements({
					source,
					x: center.x + SEQUENCE_PANEL_CANVAS_OFFSET_X,
					y: center.y,
					defaults,
					appearance,
				});
				applyMutation({
					create: created,
					update: [],
					deleteIds: [],
					selectedIds: created.map(({ id }) => id),
				});
			}}
			onClose={onClose}
		/>
	);
}
