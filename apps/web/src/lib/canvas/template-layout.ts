import type { CanvasElement } from "@skedra/canvas-core";
import {
	TEMPLATE_SECTION_GAP,
	TEMPLATE_SECTION_PADDING_TOP,
	TEMPLATE_SECTION_PADDING_TOP_COMPACT,
	TEMPLATE_SECTION_PADDING_X,
	type TemplateToolId,
	getTemplateSectionMeta,
	getTemplateStickyMetrics,
	isRecord,
	listSectionStickyNotes,
} from "./template-meta";

function buildTemplateSectionLayout(
	section: CanvasElement,
	notes: CanvasElement[],
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sectionMeta = getTemplateSectionMeta(section);
	if (!sectionMeta) return [];
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	const { noteWidth, noteHeight } = getTemplateStickyMetrics(
		section,
		sectionMeta,
	);
	const usableWidth = Math.max(
		noteWidth,
		section.width - TEMPLATE_SECTION_PADDING_X * 2,
	);
	const paddingTop = section.text
		? TEMPLATE_SECTION_PADDING_TOP
		: TEMPLATE_SECTION_PADDING_TOP_COMPACT;
	const columns = Math.max(
		1,
		Math.floor(
			(usableWidth + TEMPLATE_SECTION_GAP) / (noteWidth + TEMPLATE_SECTION_GAP),
		),
	);
	let maxBottom = section.y + sectionMeta.templateBaseHeight;

	notes.forEach((note, index) => {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const nextX =
			section.x +
			TEMPLATE_SECTION_PADDING_X +
			column * (noteWidth + TEMPLATE_SECTION_GAP);
		const nextY =
			section.y + paddingTop + row * (noteHeight + TEMPLATE_SECTION_GAP);
		maxBottom = Math.max(maxBottom, nextY + noteHeight + TEMPLATE_SECTION_GAP);
		const noteChanges: Partial<CanvasElement> = {};
		if (note.x !== nextX || note.y !== nextY) {
			noteChanges.x = nextX;
			noteChanges.y = nextY;
		}
		if (note.width !== noteWidth || note.height !== noteHeight) {
			noteChanges.width = noteWidth;
			noteChanges.height = noteHeight;
		}
		if (Object.keys(noteChanges).length > 0) {
			updates.push({ id: note.id, changes: noteChanges });
		}
	});

	const nextHeight = Math.max(
		sectionMeta.templateBaseHeight,
		maxBottom - section.y,
	);
	if (section.height !== nextHeight) {
		updates.push({ id: section.id, changes: { height: nextHeight } });
	}

	return updates;
}

export function buildTemplateSectionLayoutSyncUpdates(
	elements: Map<string, CanvasElement>,
	options?: {
		excludeIds?: Iterable<string>;
		targetByNote?: Map<string, string | null>;
	},
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const excludeIds = new Set(options?.excludeIds ?? []);
	const nextElements = new Map<string, CanvasElement>();
	for (const [id, element] of elements) {
		if (excludeIds.has(id)) continue;
		nextElements.set(id, element);
	}

	if (options?.targetByNote) {
		for (const [noteId, frameId] of options.targetByNote) {
			const note = nextElements.get(noteId);
			if (!note) continue;
			nextElements.set(noteId, { ...note, frameId: frameId ?? undefined });
		}
	}

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const section of nextElements.values()) {
		if (!getTemplateSectionMeta(section)) continue;
		const notes = listSectionStickyNotes(section.id, nextElements.values());
		updates.push(...buildTemplateSectionLayout(section, notes));
	}

	for (const update of updates) {
		const current = nextElements.get(update.id);
		if (!current) continue;
		nextElements.set(update.id, { ...current, ...update.changes });
	}

	for (const [key, groupElements] of collectTemplateLayoutGroups(
		nextElements,
	)) {
		const [tool] = key.split(":");
		if (tool === "swot") {
			updates.push(...buildSwotBoardLayoutUpdates(groupElements, nextElements));
			continue;
		}
		if (tool === "retrospective") {
			updates.push(
				...buildRetrospectiveBoardLayoutUpdates(groupElements, nextElements),
			);
		}
	}

	if (
		updates.length === 0 ||
		!updates.some((update) => {
			const element = nextElements.get(update.id);
			return getTemplateSectionMeta(element)?.templateTool === "swot";
		})
	) {
		updates.push(...buildLegacySwotBoardLayoutUpdates(nextElements));
	}

	return updates;
}

function buildArrowChanges(points: [number, number][]): Partial<CanvasElement> {
	const minX = Math.min(...points.map(([x]) => x));
	const minY = Math.min(...points.map(([, y]) => y));
	const maxX = Math.max(...points.map(([x]) => x));
	const maxY = Math.max(...points.map(([, y]) => y));
	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: points.map(([x, y]) => [x - minX, y - minY] as [number, number]),
		arrowMode: points.length > 2 ? "elbow" : "straight",
		arrowHeadStart: "none",
		arrowHeadEnd: "none",
	};
}

function areTemplateValuesEqual(left: unknown, right: unknown): boolean {
	if (
		Array.isArray(left) ||
		Array.isArray(right) ||
		(typeof left === "object" && left != null) ||
		(typeof right === "object" && right != null)
	) {
		return JSON.stringify(left) === JSON.stringify(right);
	}
	return left === right;
}

function pushTemplateUpdateIfChanged(
	element: CanvasElement | undefined,
	changes: Partial<CanvasElement>,
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	if (!element) return;
	const hasRealChange = Object.entries(changes).some(
		([key, value]) =>
			!areTemplateValuesEqual(element[key as keyof CanvasElement], value),
	);
	if (!hasRealChange) return;
	updates.push({ id: element.id, changes });
}

function getTemplateLayoutMeta(
	element: CanvasElement | null | undefined,
): { tool: TemplateToolId; layoutId: string; role: string } | null {
	if (!element || !isRecord(element.customData)) return null;
	const { templateTool, templateLayoutId, templateLayoutRole } =
		element.customData;
	if (
		(templateTool !== "retrospective" &&
			templateTool !== "swot" &&
			templateTool !== "flowchart") ||
		typeof templateLayoutId !== "string" ||
		typeof templateLayoutRole !== "string"
	) {
		return null;
	}
	return {
		tool: templateTool,
		layoutId: templateLayoutId,
		role: templateLayoutRole,
	};
}

function collectTemplateLayoutGroups(elements: Map<string, CanvasElement>) {
	const groups = new Map<string, CanvasElement[]>();
	for (const element of elements.values()) {
		const layoutMeta = getTemplateLayoutMeta(element);
		if (!layoutMeta) continue;
		const key = `${layoutMeta.tool}:${layoutMeta.layoutId}`;
		const current = groups.get(key) ?? [];
		current.push(element);
		groups.set(key, current);
	}
	return groups;
}

function moveSectionWithNotes(
	section: CanvasElement,
	nextX: number,
	nextY: number,
	elements: Map<string, CanvasElement>,
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	const dx = nextX - section.x;
	const dy = nextY - section.y;
	if (dx === 0 && dy === 0) return;

	updates.push({ id: section.id, changes: { x: nextX, y: nextY } });
	for (const note of listSectionStickyNotes(section.id, elements.values())) {
		updates.push({
			id: note.id,
			changes: { x: note.x + dx, y: note.y + dy },
		});
	}
}

function buildSwotBoardLayoutUpdates(
	groupElements: CanvasElement[],
	elements: Map<string, CanvasElement>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const roleMap = new Map<string, CanvasElement>();
	for (const element of groupElements) {
		const meta = getTemplateLayoutMeta(element);
		if (!meta) continue;
		roleMap.set(meta.role, element);
	}

	const inferSectionById = (sectionId: string) =>
		groupElements.find(
			(element) =>
				getTemplateSectionMeta(element)?.templateSectionId === sectionId,
		);
	const strengths = roleMap.get("strengths") ?? inferSectionById("strengths");
	const weaknesses =
		roleMap.get("weaknesses") ?? inferSectionById("weaknesses");
	const opportunities =
		roleMap.get("opportunities") ?? inferSectionById("opportunities");
	const threats = roleMap.get("threats") ?? inferSectionById("threats");
	if (!strengths || !weaknesses || !opportunities || !threats) return [];

	const rowGap = 38;
	const labelTopOffset = 38;
	const axisVerticalMargin = 8;
	const leftLabelOffset = 138;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];

	const topY = Math.min(strengths.y, weaknesses.y);
	const bottomY =
		Math.max(strengths.y + strengths.height, weaknesses.y + weaknesses.height) +
		rowGap;
	moveSectionWithNotes(
		opportunities,
		opportunities.x,
		bottomY,
		elements,
		updates,
	);
	moveSectionWithNotes(threats, threats.x, bottomY, elements, updates);

	const nextBottomOpportunities = bottomY + opportunities.height;
	const nextBottomThreats = bottomY + threats.height;
	const axisCenterX = (strengths.x + strengths.width + weaknesses.x) / 2;
	const axisCenterY = bottomY - rowGap / 2;

	const labelInternal =
		roleMap.get("label-internal") ??
		groupElements.find(
			(element) =>
				element.type === "text" &&
				element.y < topY &&
				Math.abs(element.x - strengths.x) < 24,
		);
	if (
		labelInternal &&
		(labelInternal.y !== topY - labelTopOffset ||
			labelInternal.x !== strengths.x)
	) {
		pushTemplateUpdateIfChanged(
			labelInternal,
			{ x: strengths.x, y: topY - labelTopOffset, width: strengths.width },
			updates,
		);
	}

	const labelExternal =
		roleMap.get("label-external") ??
		groupElements.find(
			(element) =>
				element.type === "text" &&
				element.y < topY &&
				Math.abs(element.x - weaknesses.x) < 24,
		);
	if (
		labelExternal &&
		(labelExternal.y !== topY - labelTopOffset ||
			labelExternal.x !== weaknesses.x)
	) {
		pushTemplateUpdateIfChanged(
			labelExternal,
			{ x: weaknesses.x, y: topY - labelTopOffset, width: weaknesses.width },
			updates,
		);
	}

	const labelSupport =
		roleMap.get("label-support") ??
		groupElements.find(
			(element) =>
				element.type === "text" &&
				element.x < strengths.x &&
				Math.abs(element.y - (topY + strengths.height / 2 - 12)) < 80,
		);
	if (labelSupport) {
		pushTemplateUpdateIfChanged(
			labelSupport,
			{
				x: strengths.x - leftLabelOffset,
				y: topY + strengths.height / 2 - 12,
			},
			updates,
		);
	}

	const labelRisk =
		roleMap.get("label-risk") ??
		groupElements.find(
			(element) =>
				element.type === "text" &&
				element.x < opportunities.x &&
				Math.abs(element.y - (bottomY + opportunities.height / 2 - 12)) < 80,
		);
	if (labelRisk) {
		pushTemplateUpdateIfChanged(
			labelRisk,
			{
				x: opportunities.x - leftLabelOffset,
				y: bottomY + opportunities.height / 2 - 12,
			},
			updates,
		);
	}

	const horizontalAxis =
		roleMap.get("axis-horizontal") ??
		groupElements.find((element) => {
			if (element.type !== "arrow") return false;
			const centerY = element.y + element.height / 2;
			return (
				Math.abs(centerY - axisCenterY) < 80 &&
				element.width > weaknesses.x + weaknesses.width - strengths.x - 100
			);
		});
	if (horizontalAxis) {
		pushTemplateUpdateIfChanged(
			horizontalAxis,
			buildArrowChanges([
				[strengths.x - axisVerticalMargin, axisCenterY],
				[weaknesses.x + weaknesses.width + axisVerticalMargin, axisCenterY],
			]),
			updates,
		);
	}

	const verticalAxis =
		roleMap.get("axis-vertical") ??
		groupElements.find((element) => {
			if (element.type !== "arrow") return false;
			const centerX = element.x + element.width / 2;
			return (
				Math.abs(centerX - axisCenterX) < 80 &&
				element.height > Math.max(strengths.height, opportunities.height) + 120
			);
		});
	if (verticalAxis) {
		pushTemplateUpdateIfChanged(
			verticalAxis,
			buildArrowChanges([
				[axisCenterX, topY - axisVerticalMargin],
				[
					axisCenterX,
					Math.max(nextBottomOpportunities, nextBottomThreats) +
						axisVerticalMargin,
				],
			]),
			updates,
		);
	}

	return updates;
}

function buildLegacySwotBoardLayoutUpdates(
	elements: Map<string, CanvasElement>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const swotSections = Array.from(elements.values()).filter((element) => {
		const meta = getTemplateSectionMeta(element);
		return meta?.templateTool === "swot";
	});
	if (swotSections.length !== 4) return [];

	const byId = new Map(
		swotSections.map((section) => [
			getTemplateSectionMeta(section)?.templateSectionId ?? "",
			section,
		]),
	);
	const strengths = byId.get("strengths");
	const weaknesses = byId.get("weaknesses");
	const opportunities = byId.get("opportunities");
	const threats = byId.get("threats");
	if (!strengths || !weaknesses || !opportunities || !threats) return [];

	const fakeGroup = [
		strengths,
		weaknesses,
		opportunities,
		threats,
		...Array.from(elements.values()).filter((element) => {
			if (element.type === "arrow") return true;
			if (element.type !== "text") return false;
			if (element.y < strengths.y) return true;
			return element.x < strengths.x && element.width <= 140;
		}),
	];

	return buildSwotBoardLayoutUpdates(fakeGroup, elements);
}

function buildRetrospectiveBoardLayoutUpdates(
	groupElements: CanvasElement[],
	elements: Map<string, CanvasElement>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const roleMap = new Map<string, CanvasElement[]>();
	for (const element of groupElements) {
		const meta = getTemplateLayoutMeta(element);
		if (!meta) continue;
		const current = roleMap.get(meta.role) ?? [];
		current.push(element);
		roleMap.set(meta.role, current);
	}

	const celebrate = roleMap.get("celebrate")?.[0];
	const friction = roleMap.get("friction")?.[0];
	const commitment = roleMap.get("commitment")?.[0];
	if (!celebrate || !friction || !commitment) return [];

	const modulesY =
		Math.max(
			celebrate.y + celebrate.height,
			friction.y + friction.height,
			commitment.y + commitment.height,
		) + 54;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];

	for (const role of ["experiment", "owner", "date", "signal"] as const) {
		const moduleElements = roleMap.get(role) ?? [];
		if (moduleElements.length === 0) continue;
		const currentTop = Math.min(...moduleElements.map((element) => element.y));
		const dy = modulesY - currentTop;
		if (dy === 0) continue;
		for (const element of moduleElements) {
			updates.push({
				id: element.id,
				changes: { y: element.y + dy },
			});
		}
	}

	return updates;
}
