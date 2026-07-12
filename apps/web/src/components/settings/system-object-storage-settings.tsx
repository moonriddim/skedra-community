import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Check, Cloud, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type ObjectStorageProvider = "inline" | "s3";
type ObjectStoragePreset = "custom" | "r2" | "ovh" | "aws";

export function SystemObjectStorageSettings() {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: status, isLoading } =
		trpc.instance.getObjectStorageStatus.useQuery();

	const [useCustomObjectStorage, setUseCustomObjectStorage] = useState(false);
	const [provider, setProvider] = useState<ObjectStorageProvider>("s3");
	const [preset, setPreset] = useState<ObjectStoragePreset>("r2");
	const [endpoint, setEndpoint] = useState("");
	const [region, setRegion] = useState("auto");
	const [bucket, setBucket] = useState("");
	const [accessKeyId, setAccessKeyId] = useState("");
	const [secretAccessKey, setSecretAccessKey] = useState("");
	const [clearSecretAccessKey, setClearSecretAccessKey] = useState(false);
	const [publicBaseUrl, setPublicBaseUrl] = useState("");
	const [forcePathStyle, setForcePathStyle] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!status) return;
		setUseCustomObjectStorage(status.useCustomObjectStorage);
		setProvider(status.objectStorageProvider === "s3" ? "s3" : "inline");
		setPreset(
			status.objectStoragePreset === "r2" ||
				status.objectStoragePreset === "ovh" ||
				status.objectStoragePreset === "aws"
				? status.objectStoragePreset
				: "custom",
		);
		setEndpoint(status.objectStorageEndpoint ?? "");
		setRegion(status.objectStorageRegion ?? "auto");
		setBucket(status.objectStorageBucket ?? "");
		setAccessKeyId(status.objectStorageAccessKeyId ?? "");
		setPublicBaseUrl(status.objectStoragePublicBaseUrl ?? "");
		setForcePathStyle(status.objectStorageForcePathStyle);
	}, [status]);

	const updateObjectStorage = trpc.instance.updateObjectStorage.useMutation({
		onSuccess: () => {
			setMessage(t("systemSettings.messages.objectStorageSaved"));
			setError("");
			setSecretAccessKey("");
			setClearSecretAccessKey(false);
			void utils.instance.getObjectStorageStatus.invalidate();
			void utils.assets.getUploadConfig.invalidate();
		},
		onError: (mutationError) => {
			setError(
				mutationError.message ||
					t("systemSettings.messages.objectStorageSaveFailed"),
			);
			setMessage("");
		},
	});

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-primary" />
			</div>
		);
	}

	const sourceLabel =
		status?.source === "database"
			? t("systemSettings.objectStorageCard.sources.database")
			: status?.source === "env"
				? t("systemSettings.objectStorageCard.sources.env")
				: t("systemSettings.objectStorageCard.sources.inline");
	if (status?.objectStorageSettingsEditable === false) {
		return (
			<div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<Cloud className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-foreground">
							{t("systemSettings.objectStorageCard.title")}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{t("systemSettings.objectStorageCard.description")}
						</p>
					</div>
				</div>
				<div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
					<p className="font-medium text-foreground">
						{t("systemSettings.objectStorageCard.statusTitle")}
					</p>
					<p className="mt-1 text-muted-foreground">
						{t("systemSettings.objectStorageCard.activeSource")}: {sourceLabel}
					</p>
				</div>
				<p className="text-sm text-muted-foreground">
					{t("systemSettings.objectStorageCard.managedHint")}
				</p>
			</div>
		);
	}

	const handlePresetChange = (nextPreset: ObjectStoragePreset) => {
		setPreset(nextPreset);
		if (nextPreset === "r2") setRegion("auto");
		if (nextPreset === "aws" && region === "auto") setRegion("us-east-1");
	};

	return (
		<div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
			<div className="flex items-center gap-3">
				<div className="rounded-xl bg-primary/10 p-2 text-primary">
					<Cloud className="h-5 w-5" />
				</div>
				<div>
					<h3 className="text-base font-semibold text-foreground">
						{t("systemSettings.objectStorageCard.title")}
					</h3>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{t("systemSettings.objectStorageCard.description")}
					</p>
				</div>
			</div>

			<div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
				<p className="font-medium text-foreground">
					{t("systemSettings.objectStorageCard.statusTitle")}
				</p>
				<p className="mt-1 text-muted-foreground">
					{t("systemSettings.objectStorageCard.activeSource")}: {sourceLabel}
					{status?.bucket ? ` - ${status.bucket}` : ""}
				</p>
			</div>

			<label className="flex items-start gap-3 text-sm">
				<input
					type="checkbox"
					checked={useCustomObjectStorage}
					onChange={(event) => setUseCustomObjectStorage(event.target.checked)}
					className="mt-1"
				/>
				<span>
					<span className="font-medium text-foreground">
						{t("systemSettings.objectStorageCard.useCustomConfig")}
					</span>
					<span className="mt-0.5 block text-muted-foreground">
						{t("systemSettings.objectStorageCard.useCustomConfigHint")}
					</span>
				</span>
			</label>

			{useCustomObjectStorage ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label={t("systemSettings.objectStorageCard.provider")}>
						<select
							className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
							value={provider}
							onChange={(event) =>
								setProvider(event.target.value as ObjectStorageProvider)
							}
						>
							<option value="inline">
								{t("systemSettings.objectStorageCard.providers.inline")}
							</option>
							<option value="s3">
								{t("systemSettings.objectStorageCard.providers.s3")}
							</option>
						</select>
					</Field>

					<Field label={t("systemSettings.objectStorageCard.preset")}>
						<select
							className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
							value={preset}
							disabled={provider !== "s3"}
							onChange={(event) =>
								handlePresetChange(event.target.value as ObjectStoragePreset)
							}
						>
							<option value="r2">Cloudflare R2</option>
							<option value="ovh">OVH Object Storage</option>
							<option value="aws">AWS S3</option>
							<option value="custom">
								{t("systemSettings.objectStorageCard.presets.custom")}
							</option>
						</select>
					</Field>

					{provider === "s3" ? (
						<>
							<Field
								label={t("systemSettings.objectStorageCard.endpoint")}
								wide
							>
								<Input
									value={endpoint}
									onChange={(event) => setEndpoint(event.target.value)}
									placeholder="https://<account>.r2.cloudflarestorage.com"
								/>
							</Field>
							<Field label={t("systemSettings.objectStorageCard.region")}>
								<Input
									value={region}
									onChange={(event) => setRegion(event.target.value)}
								/>
							</Field>
							<Field label={t("systemSettings.objectStorageCard.bucket")}>
								<Input
									value={bucket}
									onChange={(event) => setBucket(event.target.value)}
								/>
							</Field>
							<Field
								label={t("systemSettings.objectStorageCard.accessKeyId")}
								wide
							>
								<Input
									value={accessKeyId}
									onChange={(event) => setAccessKeyId(event.target.value)}
								/>
							</Field>
							<Field
								label={t("systemSettings.objectStorageCard.secretAccessKey")}
								wide
							>
								<Input
									type="password"
									value={secretAccessKey}
									onChange={(event) => setSecretAccessKey(event.target.value)}
									placeholder={t(
										"systemSettings.objectStorageCard.secretPlaceholder",
									)}
								/>
								<p className="text-xs text-muted-foreground">
									{status?.hasStoredSecretAccessKey
										? t("systemSettings.objectStorageCard.secretConfigured")
										: t("systemSettings.objectStorageCard.secretNotConfigured")}
								</p>
								{status?.hasStoredSecretAccessKey ? (
									<label className="flex items-center gap-2 text-xs text-muted-foreground">
										<input
											type="checkbox"
											checked={clearSecretAccessKey}
											onChange={(event) =>
												setClearSecretAccessKey(event.target.checked)
											}
										/>
										{t("systemSettings.objectStorageCard.clearSecret")}
									</label>
								) : null}
							</Field>
							<Field
								label={t("systemSettings.objectStorageCard.publicBaseUrl")}
								wide
							>
								<Input
									value={publicBaseUrl}
									onChange={(event) => setPublicBaseUrl(event.target.value)}
									placeholder="https://files.example.com"
								/>
							</Field>
							<label className="flex items-center gap-2 text-sm sm:col-span-2">
								<input
									type="checkbox"
									checked={forcePathStyle}
									onChange={(event) => setForcePathStyle(event.target.checked)}
								/>
								{t("systemSettings.objectStorageCard.forcePathStyle")}
							</label>
						</>
					) : null}
				</div>
			) : null}

			<p className="text-xs text-muted-foreground">
				{t("systemSettings.objectStorageCard.e2eeHint")}
			</p>
			{message ? <p className="text-sm text-emerald-600">{message}</p> : null}
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<Button
				disabled={updateObjectStorage.isPending}
				onClick={() =>
					updateObjectStorage.mutate({
						useCustomObjectStorage,
						provider,
						preset,
						endpoint: endpoint || undefined,
						region: region || undefined,
						bucket: bucket || undefined,
						accessKeyId: accessKeyId || undefined,
						secretAccessKey: secretAccessKey || undefined,
						clearSecretAccessKey,
						publicBaseUrl: publicBaseUrl || undefined,
						forcePathStyle,
					})
				}
			>
				{updateObjectStorage.isPending ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				) : (
					<Check className="mr-2 h-4 w-4" />
				)}
				{t("common.save")}
			</Button>
		</div>
	);
}

function Field(props: {
	label: string;
	wide?: boolean;
	children: ReactNode;
}) {
	return (
		<fieldset className={`space-y-1.5${props.wide ? " sm:col-span-2" : ""}`}>
			<legend className="block text-xs font-medium text-muted-foreground">
				{props.label}
			</legend>
			{props.children}
		</fieldset>
	);
}
