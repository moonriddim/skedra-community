/**
 * Dropdown mit @-Vorschlägen für Board-Mitglieder.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n";
import {
	type MentionCandidate,
	memberToMentionHandle,
} from "@/lib/mention-utils";
import { getUserInitials } from "@/lib/user-initials";
import { cn } from "@/lib/utils";

interface MentionSuggestionsProps {
	suggestions: MentionCandidate[];
	highlightIndex: number;
	onHighlight: (index: number) => void;
	onSelect: (member: MentionCandidate) => void;
	className?: string;
}

export function MentionSuggestions({
	suggestions,
	highlightIndex,
	onHighlight,
	onSelect,
	className,
}: MentionSuggestionsProps) {
	const { t } = useI18n();

	if (suggestions.length === 0) {
		return (
			<div
				className={cn(
					"absolute bottom-full left-0 z-50 mb-1 w-full min-w-[200px] rounded-xl border border-white/12 bg-[#1a1d24] px-3 py-2 text-xs text-white/50 shadow-lg",
					className,
				)}
			>
				{t("whiteboardPage.comments.mentionNoResults")}
			</div>
		);
	}

	return (
		<ul
			className={cn(
				"absolute bottom-full left-0 z-50 mb-1 max-h-48 w-full min-w-[220px] overflow-y-auto rounded-xl border border-white/12 bg-[#1a1d24] py-1 shadow-lg",
				className,
			)}
		>
			{suggestions.map((member, index) => (
				<li key={member.id} aria-selected={index === highlightIndex}>
					<button
						type="button"
						className={cn(
							"flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors",
							index === highlightIndex
								? "bg-white/12 text-white"
								: "text-white/85 hover:bg-white/8",
						)}
						onMouseDown={(event) => {
							// Verhindert Blur des Textfelds vor dem Klick
							event.preventDefault();
						}}
						onMouseEnter={() => onHighlight(index)}
						onClick={() => onSelect(member)}
					>
						<Avatar
							className="h-6 w-6 border border-white/10"
							style={
								member.roleColor
									? { boxShadow: `0 0 0 2px ${member.roleColor}` }
									: undefined
							}
						>
							<AvatarImage src={member.image ?? undefined} alt={member.name} />
							<AvatarFallback className="bg-white/10 text-[9px] text-white">
								{getUserInitials(member.name)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<span className="block truncate font-medium">{member.name}</span>
							{member.roleName ? (
								<span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/55">
									<span
										className="h-1.5 w-1.5 rounded-full"
										style={{ backgroundColor: member.roleColor ?? "#94a3b8" }}
									/>
									{member.roleName}
								</span>
							) : null}
						</div>
						<span className="shrink-0 text-[11px] text-white/45">
							@{memberToMentionHandle(member.name)}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}
