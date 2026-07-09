import { ThemePicker } from "@/components/theme/theme-picker";
import { useI18n } from "@/lib/i18n";
import { Palette } from "lucide-react";

/** Darstellung und Sprache — lokal im Browser gespeichert. */
export function UserPreferencesCard() {
	const { t, locale, setLocale } = useI18n();

	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
			<div className="mb-4 flex items-center gap-3">
				<div className="rounded-xl bg-primary/10 p-2 text-primary">
					<Palette className="h-5 w-5" />
				</div>
				<div>
					<h3 className="text-base font-semibold text-foreground">
						{t("profileSettings.preferencesCard.title")}
					</h3>
					<p className="text-sm text-muted-foreground">
						{t("profileSettings.preferencesCard.themeDescription")}
					</p>
				</div>
			</div>

			<div className="grid gap-6 sm:grid-cols-2">
				<div>
					<ThemePicker labelSet="profile" />
				</div>
				<div>
					<p className="mb-1.5 text-xs font-medium text-muted-foreground">
						{t("profileSettings.preferencesCard.language")}
					</p>
					<p className="mb-2 text-xs text-muted-foreground">
						{t("profileSettings.preferencesCard.languageDescription")}
					</p>
					<select
						value={locale}
						onChange={(event) => setLocale(event.target.value as "de" | "en")}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						<option value="de">{t("common.german")}</option>
						<option value="en">{t("common.english")}</option>
					</select>
				</div>
			</div>

			<p className="mt-4 text-xs text-muted-foreground">
				{t("profileSettings.preferencesCard.storageHint", { locale })}
			</p>
		</div>
	);
}
