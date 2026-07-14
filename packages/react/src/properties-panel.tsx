import type {
	SkedraAlignment,
	SkedraDistribution,
	SkedraFlowchartStepOptions,
	SkedraKanbanCardDetails,
	SkedraLayerCommand,
} from "./commands.js";
import type { CanvasElement } from "./types.js";

export interface SkedraPropertiesPanelProps {
	selected: CanvasElement[];
	readOnly?: boolean;
	onSetProperties: (properties: Partial<CanvasElement>) => void;
	onDelete: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onAlign: (alignment: SkedraAlignment) => void;
	onDistribute: (axis: SkedraDistribution) => void;
	onLayer: (command: SkedraLayerCommand) => void;
	onFlip: (axis: "horizontal" | "vertical") => void;
	onLock: (locked?: boolean) => void;
	onCropImage: (
		id: string,
		crop: { x: number; y: number; width: number; height: number },
	) => void;
	onAddFlowchartStep: (
		nodeId: string,
		options?: SkedraFlowchartStepOptions,
	) => void;
	onSetFlowchartNodeKind: (
		nodeId: string,
		kind: "start" | "step" | "decision" | "end",
	) => void;
	onUpdateKanbanCard: (
		cardId: string,
		details: SkedraKanbanCardDetails,
	) => void;
	onUpdateKanbanList: (
		listId: string,
		details: { name?: string; description?: string; wipLimit?: number | null },
	) => void;
}

export function SkedraPropertiesPanel({
	selected,
	readOnly = false,
	onSetProperties,
	onDelete,
	onGroup,
	onUngroup,
	onAlign,
	onDistribute,
	onLayer,
	onFlip,
	onLock,
	onCropImage,
	onAddFlowchartStep,
	onSetFlowchartNodeKind,
	onUpdateKanbanCard,
	onUpdateKanbanList,
}: SkedraPropertiesPanelProps) {
	if (selected.length === 0) return null;
	const element = selected[0];
	const disabled = readOnly;
	const custom = element.customData ?? {};
	const isFlowchart = custom.skedraType === "flowchart-node";
	const isKanbanCard = custom.skedraType === "kanban-card";
	const isKanbanList = custom.skedraType === "kanban-list";
	const crop =
		element.type === "image" &&
		custom.imageCrop &&
		typeof custom.imageCrop === "object"
			? (custom.imageCrop as Partial<{
					x: number;
					y: number;
					width: number;
					height: number;
				}>)
			: { x: 0, y: 0, width: 1, height: 1 };
	const updateCrop = (key: "x" | "y" | "width" | "height", value: number) => {
		onCropImage(element.id, {
			x: crop.x ?? 0,
			y: crop.y ?? 0,
			width: crop.width ?? 1,
			height: crop.height ?? 1,
			[key]: value,
		});
	};
	const numberValue = (value: number | undefined, fallback: number) =>
		Number.isFinite(value) ? value : fallback;

	return (
		<aside className="skedra-sdk__properties" aria-label="Canvas properties">
			<header className="skedra-sdk__properties-header">
				<div>
					<strong>
						{selected.length === 1
							? element.type
							: `${selected.length} elements`}
					</strong>
					<small>
						{selected.length === 1 ? element.id : "Multiple selection"}
					</small>
				</div>
				<button type="button" disabled={disabled} onClick={onDelete}>
					Delete
				</button>
			</header>

			<section>
				<h3>Geometry</h3>
				<div className="skedra-sdk__property-grid">
					{(["x", "y", "width", "height", "rotation"] as const).map((key) => (
						<label key={key}>
							<span>{key}</span>
							<input
								type="number"
								disabled={disabled || selected.length !== 1}
								value={numberValue(element[key], 0)}
								min={key === "width" || key === "height" ? 1 : undefined}
								onChange={(event) =>
									onSetProperties({ [key]: Number(event.target.value) })
								}
							/>
						</label>
					))}
				</div>
			</section>

			<section>
				<h3>Appearance</h3>
				<div className="skedra-sdk__property-grid">
					<label>
						<span>Stroke</span>
						<input
							type="color"
							disabled={disabled}
							value={
								element.stroke === "transparent" ? "#000000" : element.stroke
							}
							onChange={(event) =>
								onSetProperties({ stroke: event.target.value })
							}
						/>
					</label>
					<label>
						<span>Fill</span>
						<input
							type="color"
							disabled={disabled}
							value={element.fill === "transparent" ? "#ffffff" : element.fill}
							onChange={(event) =>
								onSetProperties({ fill: event.target.value })
							}
						/>
					</label>
					<label>
						<span>Stroke width</span>
						<input
							type="number"
							min="0"
							max="32"
							step="0.5"
							disabled={disabled}
							value={element.strokeWidth}
							onChange={(event) =>
								onSetProperties({ strokeWidth: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>Stroke style</span>
						<select
							disabled={disabled}
							value={element.strokeStyle}
							onChange={(event) =>
								onSetProperties({
									strokeStyle: event.target
										.value as CanvasElement["strokeStyle"],
								})
							}
						>
							<option value="solid">Solid</option>
							<option value="dashed">Dashed</option>
							<option value="dotted">Dotted</option>
						</select>
					</label>
					<label>
						<span>Opacity</span>
						<input
							type="range"
							min="0"
							max="100"
							disabled={disabled}
							value={element.opacity}
							onChange={(event) =>
								onSetProperties({ opacity: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>Corner radius %</span>
						<input
							type="number"
							min="0"
							max="50"
							disabled={disabled}
							value={numberValue(element.cornerRadiusPercent, 0)}
							onChange={(event) =>
								onSetProperties({
									cornerRadiusPercent: Number(event.target.value),
									cornerRadius: undefined,
								})
							}
						/>
					</label>
					<label>
						<span>Roughness</span>
						<input
							type="range"
							min="0"
							max="3"
							step="0.1"
							disabled={disabled}
							value={numberValue(element.roughness, 0)}
							onChange={(event) =>
								onSetProperties({ roughness: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>Fill style</span>
						<select
							disabled={disabled}
							value={element.roughFillStyle ?? "solid"}
							onChange={(event) =>
								onSetProperties({
									roughFillStyle: event.target
										.value as CanvasElement["roughFillStyle"],
								})
							}
						>
							<option value="solid">Solid</option>
							<option value="hachure">Hachure</option>
							<option value="cross-hatch">Cross hatch</option>
							<option value="dots">Dots</option>
							<option value="dashed">Dashed</option>
						</select>
					</label>
					<label>
						<span>Pattern scale</span>
						<input
							type="number"
							min="0.25"
							max="4"
							step="0.25"
							disabled={disabled}
							value={numberValue(element.roughFillScale, 1)}
							onChange={(event) =>
								onSetProperties({ roughFillScale: Number(event.target.value) })
							}
						/>
					</label>
				</div>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onSetProperties({ fill: "transparent" })}
				>
					Transparent fill
				</button>
			</section>

			{element.type !== "image" && (
				<section>
					<h3>Text</h3>
					<label className="skedra-sdk__property-stack">
						<span>Content</span>
						<textarea
							disabled={disabled}
							value={element.text ?? ""}
							onChange={(event) =>
								onSetProperties({ text: event.target.value })
							}
						/>
					</label>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>Color</span>
							<input
								type="color"
								disabled={disabled}
								value={element.textColor ?? element.stroke}
								onChange={(event) =>
									onSetProperties({ textColor: event.target.value })
								}
							/>
						</label>
						<label>
							<span>Size</span>
							<input
								type="number"
								min="8"
								max="256"
								disabled={disabled}
								value={numberValue(element.fontSize, 16)}
								onChange={(event) =>
									onSetProperties({ fontSize: Number(event.target.value) })
								}
							/>
						</label>
						<label>
							<span>Font</span>
							<input
								type="text"
								disabled={disabled}
								value={element.fontFamily ?? ""}
								onChange={(event) =>
									onSetProperties({ fontFamily: event.target.value })
								}
							/>
						</label>
						<label>
							<span>Align</span>
							<select
								disabled={disabled}
								value={element.textAlign ?? "left"}
								onChange={(event) =>
									onSetProperties({
										textAlign: event.target.value as CanvasElement["textAlign"],
									})
								}
							>
								<option value="left">Left</option>
								<option value="center">Center</option>
								<option value="right">Right</option>
							</select>
						</label>
						<label>
							<span>Weight</span>
							<select
								disabled={disabled}
								value={element.fontWeight ?? "normal"}
								onChange={(event) =>
									onSetProperties({
										fontWeight: event.target
											.value as CanvasElement["fontWeight"],
									})
								}
							>
								<option value="normal">Normal</option>
								<option value="bold">Bold</option>
							</select>
						</label>
						<label>
							<span>Style</span>
							<select
								disabled={disabled}
								value={element.fontStyle ?? "normal"}
								onChange={(event) =>
									onSetProperties({
										fontStyle: event.target.value as CanvasElement["fontStyle"],
									})
								}
							>
								<option value="normal">Normal</option>
								<option value="italic">Italic</option>
							</select>
						</label>
						<label>
							<span>Decoration</span>
							<select
								disabled={disabled}
								value={element.textDecoration ?? "none"}
								onChange={(event) =>
									onSetProperties({
										textDecoration: event.target
											.value as CanvasElement["textDecoration"],
									})
								}
							>
								<option value="none">None</option>
								<option value="underline">Underline</option>
							</select>
						</label>
					</div>
				</section>
			)}

			{(element.type === "arrow" || element.type === "line") && (
				<section>
					<h3>Path and arrow</h3>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>Mode</span>
							<select
								disabled={disabled}
								value={element.arrowMode ?? "straight"}
								onChange={(event) =>
									onSetProperties({
										arrowMode: event.target.value as CanvasElement["arrowMode"],
									})
								}
							>
								<option value="straight">Straight</option>
								<option value="curve">Curve</option>
								<option value="elbow">Elbow</option>
							</select>
						</label>
						<label>
							<span>Start head</span>
							<select
								disabled={disabled}
								value={element.arrowHeadStart ?? "none"}
								onChange={(event) =>
									onSetProperties({
										arrowHeadStart: event.target
											.value as CanvasElement["arrowHeadStart"],
									})
								}
							>
								<option value="none">None</option>
								<option value="arrow">Arrow</option>
								<option value="triangle">Triangle</option>
								<option value="dot">Dot</option>
							</select>
						</label>
						<label>
							<span>End head</span>
							<select
								disabled={disabled}
								value={
									element.arrowHeadEnd ??
									(element.type === "arrow" ? "arrow" : "none")
								}
								onChange={(event) =>
									onSetProperties({
										arrowHeadEnd: event.target
											.value as CanvasElement["arrowHeadEnd"],
									})
								}
							>
								<option value="none">None</option>
								<option value="arrow">Arrow</option>
								<option value="triangle">Triangle</option>
								<option value="dot">Dot</option>
							</select>
						</label>
						<label>
							<span>Head scale</span>
							<input
								type="number"
								min="0.25"
								max="4"
								step="0.25"
								disabled={disabled}
								value={numberValue(element.arrowHeadScale, 1)}
								onChange={(event) =>
									onSetProperties({
										arrowHeadScale: Number(event.target.value),
									})
								}
							/>
						</label>
					</div>
					{element.type === "line" && (element.points?.length ?? 0) >= 3 && (
						<label>
							<input
								type="checkbox"
								disabled={disabled}
								checked={element.closed === true}
								onChange={(event) =>
									onSetProperties({ closed: event.target.checked })
								}
							/>{" "}
							Closed shape
						</label>
					)}
					<label>
						<input
							type="checkbox"
							disabled={disabled}
							checked={element.arrowHeadFilled ?? true}
							onChange={(event) =>
								onSetProperties({ arrowHeadFilled: event.target.checked })
							}
						/>{" "}
						Filled arrow heads
					</label>
				</section>
			)}

			{element.type === "image" && (
				<section>
					<h3>Image crop</h3>
					<div className="skedra-sdk__property-grid">
						{(["x", "y", "width", "height"] as const).map((key) => (
							<label key={key}>
								<span>{key}</span>
								<input
									type="number"
									min="0"
									max="1"
									step="0.01"
									disabled={disabled}
									value={
										crop[key] ?? (key === "width" || key === "height" ? 1 : 0)
									}
									onChange={(event) =>
										updateCrop(key, Number(event.target.value))
									}
								/>
							</label>
						))}
					</div>
					<button
						type="button"
						disabled={disabled}
						onClick={() =>
							onCropImage(element.id, { x: 0, y: 0, width: 1, height: 1 })
						}
					>
						Reset crop
					</button>
				</section>
			)}

			{isFlowchart && (
				<section>
					<h3>Flowchart</h3>
					<select
						disabled={disabled}
						value={String(custom.flowchartNodeKind ?? "step")}
						onChange={(event) =>
							onSetFlowchartNodeKind(
								element.id,
								event.target.value as "start" | "step" | "decision" | "end",
							)
						}
					>
						<option value="start">Start</option>
						<option value="step">Step</option>
						<option value="decision">Decision</option>
						<option value="end">End</option>
					</select>
					<div className="skedra-sdk__property-actions">
						<button
							type="button"
							disabled={disabled}
							onClick={() => onAddFlowchartStep(element.id, { branch: "next" })}
						>
							Next
						</button>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onAddFlowchartStep(element.id, { branch: "yes" })}
						>
							Yes
						</button>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onAddFlowchartStep(element.id, { branch: "no" })}
						>
							No
						</button>
					</div>
				</section>
			)}

			{isKanbanCard && (
				<section>
					<h3>Kanban card</h3>
					<label className="skedra-sdk__property-stack">
						<span>Description</span>
						<textarea
							disabled={disabled}
							value={String(custom.description ?? "")}
							onChange={(event) =>
								onUpdateKanbanCard(element.id, {
									description: event.target.value,
								})
							}
						/>
					</label>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>Priority</span>
							<select
								disabled={disabled}
								value={String(custom.priority ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										priority: (event.target.value ||
											null) as SkedraKanbanCardDetails["priority"],
									})
								}
							>
								<option value="">None</option>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
								<option value="urgent">Urgent</option>
							</select>
						</label>
						<label>
							<span>Start</span>
							<input
								type="date"
								disabled={disabled}
								value={String(custom.startDate ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										startDate: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>Due</span>
							<input
								type="date"
								disabled={disabled}
								value={String(custom.dueDate ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										dueDate: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>Assignee</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.assigneeName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										assigneeName: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>Role</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.roleName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										roleName: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>Group</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.groupName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										groupName: event.target.value || null,
									})
								}
							/>
						</label>
					</div>
				</section>
			)}

			{isKanbanList && (
				<section>
					<h3>Kanban list</h3>
					<label className="skedra-sdk__property-stack">
						<span>Description</span>
						<textarea
							disabled={disabled}
							value={String(custom.description ?? "")}
							onChange={(event) =>
								onUpdateKanbanList(element.id, {
									description: event.target.value,
								})
							}
						/>
					</label>
					<label>
						<span>WIP limit</span>
						<input
							type="number"
							min="0"
							disabled={disabled}
							value={Number(custom.wipLimit ?? 0)}
							onChange={(event) =>
								onUpdateKanbanList(element.id, {
									wipLimit: Number(event.target.value) || null,
								})
							}
						/>
					</label>
				</section>
			)}

			<section>
				<h3>Arrange</h3>
				<div className="skedra-sdk__property-actions">
					{(
						[
							"left",
							"right",
							"top",
							"bottom",
							"horizontal-center",
							"vertical-center",
						] as const
					).map((alignment) => (
						<button
							key={alignment}
							type="button"
							disabled={disabled || selected.length < 2}
							onClick={() => onAlign(alignment)}
						>
							{alignment}
						</button>
					))}
					<button
						type="button"
						disabled={disabled || selected.length < 3}
						onClick={() => onDistribute("horizontal")}
					>
						Distribute H
					</button>
					<button
						type="button"
						disabled={disabled || selected.length < 3}
						onClick={() => onDistribute("vertical")}
					>
						Distribute V
					</button>
					<button
						type="button"
						disabled={disabled || selected.length < 2}
						onClick={onGroup}
					>
						Group
					</button>
					<button type="button" disabled={disabled} onClick={onUngroup}>
						Ungroup
					</button>
					{(
						[
							"bring-forward",
							"send-backward",
							"bring-to-front",
							"send-to-back",
						] as const
					).map((command) => (
						<button
							key={command}
							type="button"
							disabled={disabled}
							onClick={() => onLayer(command)}
						>
							{command}
						</button>
					))}
					<button
						type="button"
						disabled={disabled}
						onClick={() => onFlip("horizontal")}
					>
						Flip H
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => onFlip("vertical")}
					>
						Flip V
					</button>
					<button type="button" disabled={disabled} onClick={() => onLock()}>
						{selected.every((item) => item.locked) ? "Unlock" : "Lock"}
					</button>
				</div>
				<label className="skedra-sdk__property-stack">
					<span>Link</span>
					<input
						type="url"
						disabled={disabled}
						value={element.link ?? ""}
						onChange={(event) =>
							onSetProperties({ link: event.target.value || undefined })
						}
					/>
				</label>
			</section>
		</aside>
	);
}
