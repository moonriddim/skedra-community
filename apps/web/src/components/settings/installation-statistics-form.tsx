import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useId, useState } from "react";

export function InstallationStatisticsForm({
	initialChoice,
	onSave,
	pending,
	error,
	setup = false,
	saved = false,
}: {
	initialChoice: boolean | null;
	onSave: (enabled: boolean) => void;
	pending: boolean;
	error: boolean;
	setup?: boolean;
	saved?: boolean;
}) {
	const { t } = useI18n();
	const id = useId();
	const [choice, setChoice] = useState(initialChoice);
	return (
		<form
			className="space-y-5"
			onSubmit={(event) => {
				event.preventDefault();
				if (choice !== null && !pending) onSave(choice);
			}}
		>
			<div>
				{setup && (
					<p className="mb-2 text-sm text-muted-foreground">
						{t("installationStatistics.setup")}
					</p>
				)}
				<h2 className="text-xl font-semibold">
					{t("installationStatistics.title")}
				</h2>
			</div>
			<p
				className="text-sm leading-6 text-muted-foreground"
				id={`${id}-description`}
			>
				{t("installationStatistics.description")}
			</p>
			<p className="text-sm leading-6 text-muted-foreground">
				{t("installationStatistics.network")}{" "}
				<a
					href="https://skedra.xyz/privacy"
					target="_blank"
					rel="noreferrer"
					className="text-primary underline underline-offset-4"
				>
					{t("installationStatistics.privacy")}
				</a>
			</p>
			<fieldset
				disabled={pending}
				aria-describedby={`${id}-description`}
				className="grid gap-3 sm:grid-cols-2"
			>
				<legend className="sr-only">{t("installationStatistics.title")}</legend>
				{([true, false] as const).map((enabled) => (
					<label
						key={String(enabled)}
						className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
					>
						<input
							type="radio"
							name={`${id}-choice`}
							value={String(enabled)}
							checked={choice === enabled}
							onChange={() => setChoice(enabled)}
							required
							className="h-4 w-4 accent-primary"
						/>
						<span>
							{t(
								enabled
									? "installationStatistics.yes"
									: "installationStatistics.no",
							)}
						</span>
					</label>
				))}
			</fieldset>
			<p className="text-sm text-muted-foreground">
				{t("installationStatistics.changeLater")}
			</p>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{t("installationStatistics.saveError")}
				</p>
			)}
			{saved && !error && choice === initialChoice && (
				<output className="block text-sm text-muted-foreground">
					{t("installationStatistics.saved")}
				</output>
			)}
			<Button type="submit" disabled={choice === null || pending}>
				{t(
					pending
						? "installationStatistics.saving"
						: setup
							? "installationStatistics.continue"
							: "installationStatistics.save",
				)}
			</Button>
		</form>
	);
}
