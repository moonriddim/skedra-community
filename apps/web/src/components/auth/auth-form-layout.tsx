/**
 * Gemeinsames Layout fuer Login- und Registrierungsformulare.
 */

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface AuthFormLayoutProps {
	title: string;
	description: string;
	error: string;
	loading: boolean;
	submitLabel: string;
	footer: ReactNode;
	alternateActions?: ReactNode;
	onSubmit: (event: React.FormEvent) => void;
	children: ReactNode;
}

export function AuthFormLayout({
	title,
	description,
	error,
	loading,
	submitLabel,
	footer,
	alternateActions,
	onSubmit,
	children,
}: AuthFormLayoutProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 max-lg:min-h-dvh max-lg:py-6">
			<Card className="w-full max-w-md">
				<CardHeader className="items-center text-center">
					<BrandLogo
						className="justify-center"
						markClassName="h-14 w-14"
						wordmarkClassName="text-2xl"
					/>
					<div className="space-y-1">
						<CardTitle className="text-2xl">{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
				</CardHeader>
				<form onSubmit={onSubmit}>
					<CardContent className="space-y-4">
						{error && (
							<div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{error}
							</div>
						)}
						{children}
					</CardContent>
					<CardFooter className="flex flex-col gap-3">
						<Button type="submit" className="w-full" disabled={loading}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{submitLabel}
						</Button>
						{alternateActions}
						{footer}
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
