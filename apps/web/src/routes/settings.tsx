import { CanvasRolesSettings } from "@/components/settings/canvas-roles-settings";
import { LibraryReviewSettings } from "@/components/settings/library-review-settings";
import { ProfileAccountSecurity } from "@/components/settings/profile-account-security";
import { SystemCallSettings } from "@/components/settings/system-call-settings";
import { SystemSmtpSettings } from "@/components/settings/system-smtp-settings";
import { UserPreferencesCard } from "@/components/settings/user-preferences-card";
import { TeamRolesSettings } from "@/components/team/team-roles-settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getUserInitials } from "@/lib/user-initials";
import {
	OLLAMA_DEFAULT_CHAT_URL,
	OLLAMA_DEFAULT_MODEL,
	type SkedraAiProvider,
	getDefaultAiModel,
	isLocalAiProvider,
	skedraAiProviders,
} from "@skedra/shared/ai-providers";
import {
	SKEDRA_API_KEY_DEFAULT_SCOPES,
	type SkedraApiKeyScope,
	skedraApiKeyScopes,
} from "@skedra/shared/api-keys";
import {
	ArrowLeft,
	BadgeCheck,
	Check,
	Code2,
	Copy,
	Cpu,
	KeyRound,
	Loader2,
	LockKeyhole,
	Mail,
	Plus,
	RefreshCw,
	Server,
	Settings,
	Shield,
	Sparkles,
	Terminal,
	Trash2,
	User,
	UserMinus,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

type SettingsTab =
	| "profile"
	| "team"
	| "canvas-roles"
	| "api-keys"
	| "ai"
	| "system";

const SCOPE_LABELS: Record<SkedraApiKeyScope, string> = {
	"boards:read": "Boards lesen",
	"boards:write": "Boards bearbeiten",
	"members:write": "Mitglieder einladen",
	"boards:delete": "Endgültig löschen",
};

export function ApiKeysSettingsPage() {
	const { t } = useI18n();
	const utils = trpc.useUtils();
	const { data: session } = authClient.useSession();
	const { data: keys, isLoading: keysLoading } = trpc.apiKey.list.useQuery();
	const { data: aiSettings, isLoading: aiLoading } =
		trpc.ai.getSettings.useQuery();
	const { data: team, isLoading: teamLoading } = trpc.team.get.useQuery();
	const { data: mailStatus } = trpc.instance.getMailStatus.useQuery(undefined, {
		retry: false,
	});

	const showSystemTab = mailStatus?.isAdmin ?? false;
	const showTeamTab = team?.canManageWorkspace ?? false;
	const [searchParams] = useSearchParams();

	const tabFromUrl = searchParams.get("tab");
	const initialTab: SettingsTab =
		tabFromUrl === "team" && showTeamTab
			? "team"
			: tabFromUrl === "canvas-roles"
				? "canvas-roles"
				: tabFromUrl === "api-keys"
					? "api-keys"
					: tabFromUrl === "ai"
						? "ai"
						: tabFromUrl === "system" && showSystemTab
							? "system"
							: "profile";

	const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

	useEffect(() => {
		if (tabFromUrl === "team" && showTeamTab) {
			setActiveTab("team");
			requestAnimationFrame(() => {
				document
					.getElementById("workspace-roles")
					?.scrollIntoView({ behavior: "smooth" });
			});
		}
		if (tabFromUrl === "canvas-roles") {
			setActiveTab("canvas-roles");
		}
	}, [tabFromUrl, showTeamTab]);

	useEffect(() => {
		if (activeTab === "system" && !showSystemTab) setActiveTab("profile");
		if (activeTab === "team" && !showTeamTab) setActiveTab("profile");
	}, [activeTab, showSystemTab, showTeamTab]);
	const [newKeyName, setNewKeyName] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<SkedraApiKeyScope[]>([
		...SKEDRA_API_KEY_DEFAULT_SCOPES,
	]);
	const [expiresInDays, setExpiresInDays] = useState<number | "">("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// AI BYOK / lokale LLMs (Ollama, LM Studio, …)
	const [aiProvider, setAiProvider] = useState<SkedraAiProvider>("openai");
	const [aiApiKey, setAiApiKey] = useState("");
	const [aiModel, setAiModel] = useState("");
	const [aiBaseUrl, setAiBaseUrl] = useState("");

	// Team states
	const [teamNameDraft, setTeamNameDraft] = useState("");

	const createKey = trpc.apiKey.create.useMutation({
		onSuccess: (result) => {
			setCreatedKey(result.plainKey);
			setNewKeyName("");
			setSelectedScopes([...SKEDRA_API_KEY_DEFAULT_SCOPES]);
			setExpiresInDays("");
			void utils.apiKey.list.invalidate();
		},
	});

	const upsertAi = trpc.ai.upsertSettings.useMutation({
		onSuccess: (_result, variables) => {
			setAiApiKey("");
			if (variables.model) setAiModel(variables.model);
			void utils.ai.getSettings.invalidate();
		},
	});

	const aiFormDirtyRef = useRef(false);

	const aiUsesLocalProvider = isLocalAiProvider(aiProvider);
	const hasStoredKeyForProvider =
		aiSettings?.configured === true && aiSettings.provider === aiProvider;

	const aiConfigDirty = useMemo(() => {
		if (!aiSettings?.configured) return true;
		return (
			aiProvider !== aiSettings.provider ||
			aiModel !== (aiSettings.model ?? "") ||
			aiBaseUrl !== (aiSettings.baseUrl ?? "") ||
			aiApiKey.trim().length > 0
		);
	}, [aiApiKey, aiBaseUrl, aiModel, aiProvider, aiSettings]);

	// Merkt ob der Nutzer gerade editiert — verhindert Refetch-Reset des Formulars
	useEffect(() => {
		aiFormDirtyRef.current = aiConfigDirty;
	}, [aiConfigDirty]);

	const canSaveAiSettings =
		aiConfigDirty &&
		aiModel.trim().length > 0 &&
		(aiUsesLocalProvider
			? aiProvider !== "local" ||
				aiBaseUrl.trim().length > 0 ||
				hasStoredKeyForProvider
			: aiApiKey.trim().length >= 8 ||
				(aiApiKey.trim().length === 0 && hasStoredKeyForProvider));

	const handleSaveAiSettings = () => {
		const trimmedKey = aiApiKey.trim();
		upsertAi.mutate({
			provider: aiProvider,
			// Leeres Feld = gespeicherten Key behalten (nur Modell ändern)
			apiKey: trimmedKey.length >= 8 ? trimmedKey : undefined,
			model: aiModel.trim(),
			baseUrl: aiUsesLocalProvider ? aiBaseUrl.trim() || undefined : undefined,
		});
	};

	const aiSavePending = upsertAi.isPending;
	const aiSaveError = upsertAi.error;

	const handleAiProviderChange = (nextProvider: SkedraAiProvider) => {
		setAiProvider(nextProvider);
		if (nextProvider === "ollama") {
			setAiModel((current) => current || OLLAMA_DEFAULT_MODEL);
			setAiBaseUrl((current) => current || OLLAMA_DEFAULT_CHAT_URL);
		}
	};

	// Gespeicherte AI-Einstellungen ins Formular übernehmen (nicht während aktiver Bearbeitung)
	useEffect(() => {
		if (!aiSettings || !aiSettings.configured) return;
		if (aiFormDirtyRef.current) return;

		setAiProvider(aiSettings.provider);
		setAiModel(aiSettings.model ?? "");
		setAiBaseUrl(aiSettings.baseUrl ?? "");
	}, [aiSettings]);

	const canFetchAiModels =
		aiProvider === "ollama" ||
		(aiProvider === "local" && aiBaseUrl.trim().length > 0) ||
		(!isLocalAiProvider(aiProvider) &&
			(aiApiKey.trim().length >= 8 || hasStoredKeyForProvider));

	const {
		data: aiModelsData,
		isLoading: aiModelsLoading,
		isFetching: aiModelsFetching,
		error: aiModelsError,
		refetch: refetchAiModels,
	} = trpc.ai.listModels.useQuery(
		{
			provider: aiProvider,
			apiKey: aiApiKey.trim() || undefined,
			baseUrl: aiUsesLocalProvider ? aiBaseUrl.trim() || undefined : undefined,
		},
		{
			enabled: canFetchAiModels,
			staleTime: 1000 * 60,
		},
	);

	const aiModelOptions = useMemo(() => {
		const models = aiModelsData?.models ?? [];
		if (aiModel.trim() && !models.includes(aiModel.trim())) {
			return [aiModel.trim(), ...models];
		}
		return models;
	}, [aiModel, aiModelsData?.models]);

	const revokeAi = trpc.ai.revokeSettings.useMutation({
		onSuccess: () => void utils.ai.getSettings.invalidate(),
	});

	const revokeKey = trpc.apiKey.revoke.useMutation({
		onSuccess: () => void utils.apiKey.list.invalidate(),
	});

	const updateTeamName = trpc.team.updateName.useMutation({
		onSuccess: () => {
			void utils.team.get.invalidate();
		},
	});

	const mcpConfigSnippet = useMemo(() => {
		const keyVal = createdKey ?? "sked_DEIN_KEY_HIER";
		return `{
  "mcpServers": {
    "skedra": {
      "command": "node",
      "args": ["apps/mcp/dist/index.js"],
      "env": {
        "SKEDRA_API_URL": "http://localhost:3001/api/v1",
        "SKEDRA_API_KEY": "${keyVal}"
      }
    }
  }
}`;
	}, [createdKey]);

	const handleCopyKey = async () => {
		if (!createdKey) return;
		await navigator.clipboard.writeText(createdKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
			{/* Mobile Back Button */}
			<div className="mb-6 lg:hidden">
				<Button asChild variant="ghost" size="sm">
					<Link to="/library">
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t("settings.apiKeys.backToLibrary")}
					</Link>
				</Button>
			</div>

			<div className="grid gap-8 lg:grid-cols-[240px_1fr]">
				{/* Sidebar */}
				<aside className="space-y-6">
					<div>
						<div className="flex items-center gap-2">
							<div className="h-6 w-1 bg-primary rounded-full" />
							<p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
								Skedra
							</p>
						</div>
						<h1 className="mt-1 text-2xl font-semibold text-foreground">
							{t("settingsCenter.title") ?? "Einstellungen"}
						</h1>
					</div>

					<nav className="flex flex-row gap-1 border-b border-border pb-2 lg:flex-col lg:border-none lg:pb-0 overflow-x-auto">
						<button
							type="button"
							onClick={() => setActiveTab("profile")}
							className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
								activeTab === "profile"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
						>
							<User className="h-4 w-4" />
							<span>Mein Profil</span>
						</button>
						{showTeamTab ? (
							<button
								type="button"
								onClick={() => setActiveTab("team")}
								className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
									activeTab === "team"
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
								}`}
							>
								<Users className="h-4 w-4" />
								<span>Team-Mitglieder</span>
							</button>
						) : null}
						<button
							type="button"
							onClick={() => setActiveTab("canvas-roles")}
							className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
								activeTab === "canvas-roles"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
						>
							<Shield className="h-4 w-4" />
							<span>{t("settings.canvasRoles.nav")}</span>
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("api-keys")}
							className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
								activeTab === "api-keys"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
						>
							<KeyRound className="h-4 w-4" />
							<span>API Keys & MCP</span>
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("ai")}
							className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
								activeTab === "ai"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
						>
							<Sparkles className="h-4 w-4" />
							<span>{t("settings.ai.nav")}</span>
						</button>
						{showSystemTab ? (
							<button
								type="button"
								onClick={() => setActiveTab("system")}
								className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0 ${
									activeTab === "system"
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
								}`}
							>
								<Server className="h-4 w-4" />
								<span>{t("common.systemSettings")}</span>
							</button>
						) : null}
					</nav>

					<div className="hidden lg:block pt-4 border-t border-border">
						<Button
							asChild
							variant="ghost"
							size="sm"
							className="w-full justify-start text-muted-foreground hover:text-foreground"
						>
							<Link to="/library">
								<ArrowLeft className="mr-2 h-4 w-4" />
								{t("settings.apiKeys.backToLibrary")}
							</Link>
						</Button>
					</div>
				</aside>

				{/* Main Content Pane */}
				<main className="min-w-0 flex-1">
					{activeTab === "profile" && (
						<div className="space-y-6 animate-in fade-in-50 duration-200">
							{/* Profile Overview Card */}
							<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
								<div className="h-24 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
								<div className="px-6 pb-6 relative">
									<div className="absolute -top-10 left-6">
										<Avatar className="h-20 w-20 border-4 border-card shadow-md">
											{session?.user?.image ? (
												<AvatarImage
													src={session.user.image}
													alt={session.user.name ?? ""}
												/>
											) : null}
											<AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
												{getUserInitials(session?.user?.name ?? "")}
											</AvatarFallback>
										</Avatar>
									</div>
									<div className="pt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
										<div>
											<h2 className="text-xl font-semibold text-foreground">
												{session?.user?.name}
											</h2>
											<p className="text-sm text-muted-foreground">
												{session?.user?.email}
											</p>
										</div>
										<div className="flex items-center gap-1.5 self-start sm:self-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
											<BadgeCheck className="h-3.5 w-3.5" />
											Konto Aktiv
										</div>
									</div>
								</div>
							</div>

							{/* Account Details Card */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<h3 className="text-base font-semibold text-foreground mb-4">
									Kontoinformationen
								</h3>
								<div className="grid gap-4 sm:grid-cols-2">
									<div>
										<label
											htmlFor="settings-display-name"
											className="text-xs font-medium text-muted-foreground block mb-1"
										>
											Anzeigename
										</label>
										<Input
											id="settings-display-name"
											readOnly
											value={session?.user?.name ?? ""}
											className="bg-muted/35"
										/>
									</div>
									<div>
										<label
											htmlFor="settings-email"
											className="text-xs font-medium text-muted-foreground block mb-1"
										>
											E-Mail Adresse
										</label>
										<Input
											id="settings-email"
											readOnly
											value={session?.user?.email ?? ""}
											className="bg-muted/35"
										/>
									</div>
								</div>
							</div>

							<UserPreferencesCard />

							{session?.user?.email ? (
								<ProfileAccountSecurity email={session.user.email} />
							) : null}
						</div>
					)}

					{activeTab === "canvas-roles" && <CanvasRolesSettings />}

					{activeTab === "team" && (
						<div className="space-y-6 animate-in fade-in-50 duration-200">
							{/* Team Overview Card */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-primary/10 rounded-xl text-primary">
										<Users className="h-5 w-5" />
									</div>
									<div>
										<h2 className="text-lg font-semibold text-foreground">
											Team-Mitglieder & Workspace
										</h2>
										<p className="text-sm text-muted-foreground">
											{t("workspaceSettings.teamTabIntro")}
										</p>
									</div>
								</div>
							</div>

							{/* Update Team Name Row */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<h3 className="text-base font-semibold text-foreground">
									Arbeitsbereich Name
								</h3>
								<p className="text-sm text-muted-foreground mt-0.5">
									Gib deinem Workspace einen individuellen Namen.
								</p>
								{teamLoading ? (
									<div className="mt-4">
										<Loader2 className="h-4 w-4 animate-spin text-primary" />
									</div>
								) : (
									<div className="mt-4 flex flex-col sm:flex-row gap-3">
										<Input
											className="flex-1"
											placeholder="z. B. Mein Team, Agentur XY"
											value={
												teamNameDraft !== ""
													? teamNameDraft
													: (team?.name ?? "")
											}
											onChange={(e) => setTeamNameDraft(e.target.value)}
										/>
										<Button
											className="sm:w-auto"
											disabled={
												updateTeamName.isPending ||
												teamNameDraft === "" ||
												teamNameDraft === team?.name
											}
											onClick={() =>
												updateTeamName.mutate({ name: teamNameDraft })
											}
										>
											{updateTeamName.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Check className="mr-2 h-4 w-4" />
											)}
											Speichern
										</Button>
									</div>
								)}
							</div>

							{session?.user ? (
								<TeamRolesSettings
									sessionUser={{
										id: session.user.id,
										name: session.user.name,
										email: session.user.email,
										image: session.user.image,
									}}
								/>
							) : null}
						</div>
					)}

					{activeTab === "api-keys" && (
						<div className="space-y-6 animate-in fade-in-50 duration-200">
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-primary/10 rounded-xl text-primary">
										<KeyRound className="h-5 w-5" />
									</div>
									<div>
										<h2 className="text-lg font-semibold text-foreground">
											{t("settings.apiKeys.title")}
										</h2>
										<p className="text-sm text-muted-foreground">
											{t("settings.apiKeys.description")}
										</p>
									</div>
								</div>
							</div>

							{/* Create Key Row */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<h3 className="text-base font-semibold text-foreground">
									{t("settings.apiKeys.createTitle")}
								</h3>
								<p className="text-sm text-muted-foreground mt-0.5">
									{t("settings.apiKeys.createDescription")}
								</p>
								<div className="mt-4 flex flex-col gap-4">
									<div className="flex flex-col sm:flex-row gap-3">
										<Input
											className="flex-1"
											placeholder={t("settings.apiKeys.namePlaceholder")}
											value={newKeyName}
											onChange={(e) => setNewKeyName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter" && newKeyName.trim()) {
													createKey.mutate({
														name: newKeyName.trim(),
														scopes: selectedScopes,
														expiresInDays:
															expiresInDays === "" ? undefined : expiresInDays,
													});
												}
											}}
										/>
										<select
											className="h-10 rounded-md border border-border bg-background px-3 text-sm"
											value={expiresInDays === "" ? "" : String(expiresInDays)}
											onChange={(e) =>
												setExpiresInDays(
													e.target.value ? Number(e.target.value) : "",
												)
											}
										>
											<option value="">
												{t("settings.apiKeys.expiresNever")}
											</option>
											<option value="30">
												{t("settings.apiKeys.expiresDays", { days: 30 })}
											</option>
											<option value="90">
												{t("settings.apiKeys.expiresDays", { days: 90 })}
											</option>
											<option value="365">
												{t("settings.apiKeys.expiresDays", { days: 365 })}
											</option>
										</select>
										<Button
											className="sm:w-auto"
											disabled={
												!newKeyName.trim() ||
												selectedScopes.length === 0 ||
												createKey.isPending
											}
											onClick={() =>
												createKey.mutate({
													name: newKeyName.trim(),
													scopes: selectedScopes,
													expiresInDays:
														expiresInDays === "" ? undefined : expiresInDays,
												})
											}
										>
											{createKey.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Plus className="mr-2 h-4 w-4" />
											)}
											{t("settings.apiKeys.createAction")}
										</Button>
									</div>
									<div className="space-y-2">
										<p className="text-sm font-medium text-foreground">
											{t("settings.apiKeys.scopesTitle")}
										</p>
										<div className="flex flex-wrap gap-3">
											{skedraApiKeyScopes.map((scope) => (
												<label
													key={scope}
													className="flex items-center gap-2 text-sm"
												>
													<input
														type="checkbox"
														checked={selectedScopes.includes(scope)}
														onChange={(e) => {
															setSelectedScopes((current) =>
																e.target.checked
																	? [...current, scope]
																	: current.filter((item) => item !== scope),
															);
														}}
													/>
													{SCOPE_LABELS[scope]}
												</label>
											))}
										</div>
									</div>
								</div>
							</div>

							{/* List Keys Panel */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<h3 className="text-base font-semibold text-foreground mb-4">
									{t("settings.apiKeys.listTitle")}
								</h3>
								{keysLoading ? (
									<div className="flex justify-center py-8">
										<Loader2 className="h-6 w-6 animate-spin text-primary" />
									</div>
								) : keys && keys.length > 0 ? (
									<div className="overflow-hidden rounded-xl border border-border/70 bg-background/50 divide-y divide-border/60">
										{keys.map((key) => (
											<div
												key={key.id}
												className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/20"
											>
												<div className="min-w-0 space-y-1">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-sm text-foreground truncate">
															{key.name}
														</span>
														<span className="relative flex h-2 w-2">
															<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
															<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
														</span>
													</div>
													<div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground font-mono">
														<span>{key.keyPrefix}…</span>
														<span className="text-border/80 font-sans">•</span>
														<span className="font-sans">
															{t("settings.apiKeys.createdAt", {
																date: new Date(
																	key.createdAt,
																).toLocaleDateString(),
															})}
														</span>
														{key.lastUsedAt && (
															<>
																<span className="text-border/80 font-sans">
																	•
																</span>
																<span className="font-sans">
																	{t("settings.apiKeys.lastUsed", {
																		date: new Date(
																			key.lastUsedAt,
																		).toLocaleDateString(),
																	})}
																</span>
															</>
														)}
														{key.expiresAt && (
															<>
																<span className="text-border/80 font-sans">
																	•
																</span>
																<span className="font-sans">
																	{t("settings.apiKeys.expiresAt", {
																		date: new Date(
																			key.expiresAt,
																		).toLocaleDateString(),
																	})}
																</span>
															</>
														)}
													</div>
													<p className="text-[11px] text-muted-foreground font-sans">
														{key.scopes
															.map((scope) => SCOPE_LABELS[scope])
															.join(" · ")}
													</p>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="text-muted-foreground hover:text-destructive shrink-0"
													disabled={revokeKey.isPending}
													onClick={() => revokeKey.mutate({ id: key.id })}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										))}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 text-center bg-background/30">
										<LockKeyhole className="h-8 w-8 text-muted-foreground/60 mb-2" />
										<p className="text-sm text-muted-foreground">
											{t("settings.apiKeys.empty")}
										</p>
									</div>
								)}
							</div>

							{/* MCP Integrations box */}
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
								<div className="flex items-start gap-3">
									<div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 mt-0.5">
										<Cpu className="h-5 w-5" />
									</div>
									<div>
										<h3 className="text-base font-semibold text-foreground">
											{t("settings.apiKeys.mcpTitle")}
										</h3>
										<p className="text-sm text-muted-foreground mt-0.5">
											{t("settings.apiKeys.mcpDescription")}
										</p>
									</div>
								</div>

								{/* JSON Code snippet */}
								<div className="relative group">
									<div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="secondary"
											size="sm"
											className="h-7 text-xs bg-card/85 shadow-sm hover:bg-card border"
											onClick={async () => {
												await navigator.clipboard.writeText(mcpConfigSnippet);
											}}
										>
											<Copy className="h-3 w-3 mr-1" />
											Kopieren
										</Button>
									</div>
									<pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-slate-200 border border-slate-900 leading-relaxed shadow-inner">
										<code>
											<span className="text-purple-400">{"{"}</span>
											{"\n  "}
											<span className="text-sky-300">"mcpServers"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-purple-400">{"{"}</span>
											{"\n    "}
											<span className="text-sky-300">"skedra"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-purple-400">{"{"}</span>
											{"\n      "}
											<span className="text-sky-300">"command"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-emerald-300">"node"</span>
											<span className="text-slate-400">,</span>
											{"\n      "}
											<span className="text-sky-300">"args"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-purple-400">[</span>
											<span className="text-emerald-300">
												"apps/mcp/dist/index.js"
											</span>
											<span className="text-purple-400">]</span>
											<span className="text-slate-400">,</span>
											{"\n      "}
											<span className="text-sky-300">"env"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-purple-400">{"{"}</span>
											{"\n        "}
											<span className="text-sky-300">"SKEDRA_API_URL"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-emerald-300">
												"http://localhost:3001/api/v1"
											</span>
											<span className="text-slate-400">,</span>
											{"\n        "}
											<span className="text-sky-300">"SKEDRA_API_KEY"</span>
											<span className="text-slate-400">:</span>{" "}
											<span className="text-emerald-300">
												"{createdKey ?? "sked_DEIN_KEY_HIER"}"
											</span>
											{"\n      "}
											<span className="text-purple-400">{"}"}</span>
											{"\n    "}
											<span className="text-purple-400">{"}"}</span>
											{"\n  "}
											<span className="text-purple-400">{"}"}</span>
											{"\n"}
											<span className="text-purple-400">{"}"}</span>
										</code>
									</pre>
								</div>

								<div className="rounded-xl bg-muted/40 p-4 border border-border/50 divide-y divide-border/40 text-xs text-muted-foreground space-y-2.5">
									<div className="flex items-center gap-2">
										<Code2 className="h-4 w-4 text-primary shrink-0" />
										<span>{t("settings.apiKeys.mcpHint")}</span>
									</div>
									<div className="flex items-center gap-2 pt-2.5">
										<Terminal className="h-4 w-4 text-primary shrink-0" />
										<span>
											{t("settings.apiKeys.openapiHint")}{" "}
											<a
												href="/api/openapi.json"
												className="text-primary hover:underline font-semibold"
												target="_blank"
												rel="noreferrer"
											>
												/api/openapi.json
											</a>
										</span>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === "system" && (
						<div className="space-y-6 animate-in fade-in-50 duration-200">
							<SystemSmtpSettings />
							<SystemCallSettings />
							<LibraryReviewSettings />
						</div>
					)}

					{activeTab === "ai" && (
						<div className="space-y-6 animate-in fade-in-50 duration-200">
							<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-primary/10 rounded-xl text-primary">
										<Sparkles className="h-5 w-5" />
									</div>
									<div>
										<h2 className="text-lg font-semibold text-foreground">
											{t("settings.ai.title")}
										</h2>
										<p className="text-sm text-muted-foreground">
											{t("settings.ai.description")}
										</p>
									</div>
								</div>
							</div>

							{aiLoading ? (
								<div className="flex justify-center py-12">
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
								</div>
							) : (
								<div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
									{aiSettings?.configured && (
										<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
											<p className="font-medium text-foreground">
												{t("settings.ai.configured")}
											</p>
											<p className="mt-1 text-muted-foreground">
												{aiSettings.provider} · {aiSettings.keyHint}
												{aiSettings.model ? ` · ${aiSettings.model}` : ""}
												{aiSettings.baseUrl ? ` · ${aiSettings.baseUrl}` : ""}
											</p>
										</div>
									)}

									{!aiSettings?.configured &&
										aiSettings?.platformFallbackAvailable && (
											<div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
												{t("settings.ai.platformFallback")}
											</div>
										)}

									<div className="grid gap-4 sm:grid-cols-2">
										<label className="space-y-1.5 text-sm">
											<span className="font-medium">
												{t("settings.ai.provider")}
											</span>
											<select
												className="h-10 w-full rounded-md border border-border bg-background px-3"
												value={aiProvider}
												onChange={(e) =>
													handleAiProviderChange(
														e.target.value as SkedraAiProvider,
													)
												}
											>
												{skedraAiProviders.map((provider) => (
													<option key={provider} value={provider}>
														{t(`settings.ai.providers.${provider}`)}
													</option>
												))}
											</select>
										</label>
										<div className="space-y-1.5 text-sm">
											<div className="flex items-center justify-between gap-2">
												<label
													htmlFor="settings-ai-model"
													className="font-medium"
												>
													{t("settings.ai.model")}
												</label>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs"
													disabled={!canFetchAiModels || aiModelsFetching}
													onClick={() => void refetchAiModels()}
												>
													{aiModelsFetching ? (
														<Loader2 className="mr-1 h-3 w-3 animate-spin" />
													) : (
														<RefreshCw className="mr-1 h-3 w-3" />
													)}
													{t("settings.ai.loadModels")}
												</Button>
											</div>
											{aiModelOptions.length > 0 ? (
												<>
													<Input
														id="settings-ai-model"
														list="skedra-ai-model-options"
														value={aiModel}
														onChange={(e) => setAiModel(e.target.value)}
														placeholder={getDefaultAiModel(aiProvider)}
													/>
													<datalist id="skedra-ai-model-options">
														{aiModelOptions.map((modelId) => (
															<option key={modelId} value={modelId} />
														))}
													</datalist>
													<p className="text-xs text-muted-foreground">
														{t("settings.ai.modelInputHint")}
													</p>
												</>
											) : (
												<Input
													id="settings-ai-model"
													placeholder={getDefaultAiModel(aiProvider)}
													value={aiModel}
													onChange={(e) => setAiModel(e.target.value)}
												/>
											)}
											{aiModelsLoading && (
												<p className="text-xs text-muted-foreground">
													{t("settings.ai.modelsLoading")}
												</p>
											)}
											{aiModelsError && (
												<p className="text-xs text-destructive">
													{aiModelsError.message}
												</p>
											)}
											{!canFetchAiModels && !aiUsesLocalProvider && (
												<p className="text-xs text-muted-foreground">
													{t("settings.ai.modelsNeedKey")}
												</p>
											)}
											<p className="text-xs text-muted-foreground">
												{t("settings.ai.modelsFilteredHint")}
											</p>
										</div>
									</div>

									{aiUsesLocalProvider && (
										<div className="block space-y-1.5 text-sm">
											<label
												htmlFor="settings-ai-base-url"
												className="font-medium"
											>
												{t("settings.ai.baseUrl")}
											</label>
											<Input
												id="settings-ai-base-url"
												placeholder={OLLAMA_DEFAULT_CHAT_URL}
												value={aiBaseUrl}
												onChange={(e) => setAiBaseUrl(e.target.value)}
											/>
											<p className="text-xs text-muted-foreground">
												{t("settings.ai.localHint")}
											</p>
										</div>
									)}

									<div className="block space-y-1.5 text-sm">
										<label
											htmlFor="settings-ai-api-key"
											className="font-medium"
										>
											{aiUsesLocalProvider
												? t("settings.ai.apiKeyOptional")
												: t("settings.ai.apiKey")}
										</label>
										<Input
											id="settings-ai-api-key"
											type="password"
											placeholder={
												aiSettings?.configured &&
												aiSettings.provider === aiProvider
													? t("settings.ai.apiKeyStoredPlaceholder", {
															hint: aiSettings.keyHint,
														})
													: aiUsesLocalProvider
														? t("settings.ai.apiKeyOptionalPlaceholder")
														: t("settings.ai.apiKeyPlaceholder")
											}
											value={aiApiKey}
											onChange={(e) => setAiApiKey(e.target.value)}
										/>
										{aiSettings?.configured &&
											aiSettings.provider === aiProvider && (
												<p className="text-xs text-muted-foreground">
													{t("settings.ai.apiKeyStoredHint")}
												</p>
											)}
									</div>

									<div className="flex flex-wrap gap-3">
										{aiSaveError && (
											<p className="w-full text-sm text-destructive">
												{aiSaveError.message}
											</p>
										)}
										<Button
											disabled={!canSaveAiSettings || aiSavePending}
											onClick={handleSaveAiSettings}
										>
											{aiSavePending && (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											)}
											{t("settings.ai.save")}
										</Button>
										{aiSettings?.configured && (
											<Button
												variant="outline"
												disabled={revokeAi.isPending}
												onClick={() => revokeAi.mutate()}
											>
												{t("settings.ai.revoke")}
											</Button>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										{t("settings.ai.hint")}
									</p>
								</div>
							)}
						</div>
					)}
				</main>
			</div>

			<Dialog
				open={!!createdKey}
				onOpenChange={(open) => !open && setCreatedKey(null)}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{t("settings.apiKeys.createdDialogTitle")}
						</DialogTitle>
						<DialogDescription>
							{t("settings.apiKeys.createdDialogDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="relative group">
							<Input
								readOnly
								value={createdKey ?? ""}
								className="font-mono text-xs pr-10 select-all"
							/>
							<button
								type="button"
								onClick={handleCopyKey}
								className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
							>
								{copied ? (
									<Check className="h-4 w-4 text-emerald-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
						</div>
						<Button className="w-full" onClick={handleCopyKey}>
							{copied ? (
								<Check className="mr-2 h-4 w-4" />
							) : (
								<Copy className="mr-2 h-4 w-4" />
							)}
							{copied ? t("common.copied") : t("settings.apiKeys.copyKey")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
