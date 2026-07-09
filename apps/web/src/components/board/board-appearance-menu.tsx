import { ThemePicker } from "@/components/theme/theme-picker";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { Palette } from "lucide-react";
import { Link } from "react-router";

/** Board-Header: Design und Sprache ohne Einstellungsseite verlassen zu müssen. */
export function BoardAppearanceMenu() {
	const { t, locale, setLocale } = useI18n();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="h-9 w-9 bg-card/90 backdrop-blur-md"
					aria-label={t("profileSettings.preferencesCard.title")}
				>
					<Palette className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					{t("profileSettings.preferencesCard.title")}
				</DropdownMenuLabel>
				<div className="px-2 py-1.5">
					<ThemePicker labelSet="profile" />
				</div>
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5">
					<p className="mb-1.5 text-xs text-muted-foreground">
						{t("profileSettings.preferencesCard.language")}
					</p>
					<select
						value={locale}
						onChange={(event) => setLocale(event.target.value as "de" | "en")}
						className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
					>
						<option value="de">{t("common.german")}</option>
						<option value="en">{t("common.english")}</option>
					</select>
				</div>
				<DropdownMenuSeparator />
				<div className="px-2 py-1">
					<Link to="/settings" className="text-xs text-primary hover:underline">
						{t("settingsCenter.title")}
					</Link>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
