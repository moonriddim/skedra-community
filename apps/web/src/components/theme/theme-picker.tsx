import { useI18n } from "@/lib/i18n";
import { type Theme, useThemeStore } from "@/stores/theme";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemePickerLabelSet = "guest" | "profile";

const LABEL_KEYS: Record<
	ThemePickerLabelSet,
	Record<Theme, string> & { theme: string }
> = {
	guest: {
		theme: "guestCanvas.theme",
		light: "guestCanvas.themeLight",
		dark: "guestCanvas.themeDark",
		system: "guestCanvas.themeSystem",
	},
	profile: {
		theme: "profileSettings.preferencesCard.theme",
		light: "profileSettings.preferencesCard.themeLight",
		dark: "profileSettings.preferencesCard.themeDark",
		system: "profileSettings.preferencesCard.themeSystem",
	},
};

interface ThemePickerProps {
	/** Welche Übersetzungs-Keys für die drei Modi genutzt werden */
	labelSet?: ThemePickerLabelSet;
	/** Optionale Überschrift über den Buttons */
	showLabel?: boolean;
	className?: string;
}

/** Hell / Dunkel / System — nutzt den globalen Theme-Store (localStorage). */
export function ThemePicker({
	labelSet = "profile",
	showLabel = true,
	className,
}: ThemePickerProps) {
	const { t } = useI18n();
	const theme = useThemeStore((state) => state.theme);
	const setTheme = useThemeStore((state) => state.setTheme);
	const keys = LABEL_KEYS[labelSet];

	return (
		<div className={className}>
			{showLabel ? (
				<p className="mb-1.5 text-xs text-muted-foreground">{t(keys.theme)}</p>
			) : null}
			<div className="flex gap-1">
				<ThemeOptionButton
					active={theme === "light"}
					label={t(keys.light)}
					onClick={() => setTheme("light")}
				>
					<Sun className="h-3.5 w-3.5" />
				</ThemeOptionButton>
				<ThemeOptionButton
					active={theme === "dark"}
					label={t(keys.dark)}
					onClick={() => setTheme("dark")}
				>
					<Moon className="h-3.5 w-3.5" />
				</ThemeOptionButton>
				<ThemeOptionButton
					active={theme === "system"}
					label={t(keys.system)}
					onClick={() => setTheme("system")}
				>
					<Monitor className="h-3.5 w-3.5" />
				</ThemeOptionButton>
			</div>
		</div>
	);
}

function ThemeOptionButton({
	active,
	label,
	onClick,
	children,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			onClick={onClick}
			className={`flex flex-1 items-center justify-center rounded-md border py-1.5 transition-colors ${
				active
					? "border-primary bg-primary/15 text-primary"
					: "border-border hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}
