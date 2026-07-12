import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
	LocalCanvasPresence,
	RemoteCanvasPresence,
} from "@/hooks/canvas-sync-types";
import { getUserInitials } from "@/lib/user-initials";
import { useEffect, useState } from "react";

interface PresencePanelProps {
	currentUser: LocalCanvasPresence | null;
	peers: RemoteCanvasPresence[];
	isConnected: boolean;
	isReadonly: boolean;
	presentationMode?: boolean;
	offsetTop?: number;
	offsetRight?: number;
	summaryOffsetRight?: number;
	layout?: "card" | "column";
}

export function PresencePanel({
	currentUser,
	peers,
	isConnected,
	isReadonly,
	presentationMode = false,
	offsetTop = 12,
	offsetRight = 12,
	summaryOffsetRight = offsetRight,
	layout = "card",
}: PresencePanelProps) {
	// Nur anzeigen, wenn andere Personen online sind oder wir im Praesentationsmodus sind
	if (peers.length === 0 && !presentationMode) {
		return null;
	}

	const participants = currentUser ? [currentUser, ...peers] : peers;
	const [maxVisible, setMaxVisible] = useState(6);

	useEffect(() => {
		if (layout !== "column") return;

		const updateMaxVisible = () => {
			const availableHeight = Math.max(
				180,
				window.innerHeight - offsetTop - 140,
			);
			const next = Math.max(3, Math.min(8, Math.floor(availableHeight / 48)));
			setMaxVisible(next);
		};

		updateMaxVisible();
		window.addEventListener("resize", updateMaxVisible);
		return () => window.removeEventListener("resize", updateMaxVisible);
	}, [layout, offsetTop]);

	if (layout === "column") {
		const shouldStack = participants.length > maxVisible;
		const visibleParticipants = shouldStack
			? participants.slice(0, Math.max(2, maxVisible - 1))
			: participants;
		const remainingCount = participants.length - visibleParticipants.length;

		return (
			<>
				<div
					className="pointer-events-none absolute z-40"
					style={{ top: offsetTop, right: summaryOffsetRight }}
				>
					<div className="pointer-events-auto rounded-2xl border border-border bg-card/90 px-3 py-2 text-right shadow-xl backdrop-blur-md">
						<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Live
						</p>
						<p className="text-sm font-medium text-card-foreground">
							{participants.length} online
						</p>
					</div>
				</div>

				<div
					className="pointer-events-none absolute z-40 flex flex-col items-end gap-2 transition-[right] duration-300 ease-out"
					style={{ top: offsetTop + 60, right: offsetRight }}
				>
					<div
						className={
							shouldStack
								? "pointer-events-auto flex flex-col items-end -space-y-3"
								: "pointer-events-auto flex flex-col items-end gap-2"
						}
					>
						{visibleParticipants.map((participant) => (
							<Avatar
								key={`${participant.user.id}-${participant.updatedAt}`}
								className="h-10 w-10 border-2 border-card shadow-xl"
								style={{ boxShadow: `0 0 0 2px ${participant.user.color}` }}
							>
								{participant.user.image ? (
									<AvatarImage
										src={participant.user.image}
										alt={participant.user.name}
									/>
								) : null}
								<AvatarFallback
									className="text-[10px] font-semibold text-white"
									style={{ backgroundColor: participant.user.color }}
								>
									{getUserInitials(participant.user.name)}
								</AvatarFallback>
							</Avatar>
						))}

						{remainingCount > 0 && (
							<div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground shadow-xl">
								+{remainingCount}
							</div>
						)}
					</div>

					{isReadonly && (
						<div className="pointer-events-auto rounded-full border border-amber-300/60 bg-amber-100/90 px-3 py-1 text-[11px] font-medium text-amber-900 shadow-lg backdrop-blur-md dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
							Read-only verbunden
						</div>
					)}

					{!isConnected && (
						<div className="pointer-events-auto rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur-md">
							Realtime wird verbunden
						</div>
					)}
				</div>
			</>
		);
	}

	return (
		<div
			className="pointer-events-none absolute z-40 flex flex-col items-end gap-2 transition-[right] duration-300 ease-out"
			style={{ top: offsetTop, right: offsetRight }}
		>
			<div className="pointer-events-auto flex min-w-55 items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-xl backdrop-blur-md">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Live
					</p>
					<p className="text-sm font-medium text-card-foreground">
						{participants.length} online
					</p>
				</div>
				<div className="flex items-center -space-x-2">
					{participants.slice(0, 5).map((participant) => (
						<Avatar
							key={`${participant.user.id}-${participant.updatedAt}`}
							className="h-8 w-8 border-2 border-card"
							style={{ boxShadow: `0 0 0 2px ${participant.user.color}` }}
						>
							{participant.user.image ? (
								<AvatarImage
									src={participant.user.image}
									alt={participant.user.name}
								/>
							) : null}
							<AvatarFallback
								className="text-[10px] font-semibold text-white"
								style={{ backgroundColor: participant.user.color }}
							>
								{getUserInitials(participant.user.name)}
							</AvatarFallback>
						</Avatar>
					))}
					{participants.length > 5 && (
						<div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm">
							+{participants.length - 5}
						</div>
					)}
				</div>
			</div>

			{isReadonly && (
				<div className="pointer-events-auto rounded-full border border-amber-300/60 bg-amber-100/90 px-3 py-1 text-[11px] font-medium text-amber-900 shadow-lg backdrop-blur-md dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
					Read-only verbunden
				</div>
			)}

			{!isConnected && (
				<div className="pointer-events-auto rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur-md">
					Realtime wird verbunden
				</div>
			)}
		</div>
	);
}
