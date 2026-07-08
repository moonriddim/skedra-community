export interface SkedraWorkspaceCallStatus {
	isInCall: boolean;
	isMuted: boolean;
	isSpeaking: boolean;
	isScreenSharing: boolean;
	provider?: string;
	roomUrl?: string | null;
}

export interface SkedraWorkspaceHooks {
	callStatus: SkedraWorkspaceCallStatus;
	onStartCall?: () => void;
	onLeaveCall?: () => void;
	onToggleMute?: () => void;
	onToggleScreenShare?: () => void;
}

export const SKEDRA_WORKSPACE_CALL_DISABLED: SkedraWorkspaceCallStatus = {
	isInCall: false,
	isMuted: false,
	isSpeaking: false,
	isScreenSharing: false,
	roomUrl: null,
};

export const SKEDRA_WORKSPACE_HOOKS_DISABLED: SkedraWorkspaceHooks = {
	callStatus: SKEDRA_WORKSPACE_CALL_DISABLED,
};
