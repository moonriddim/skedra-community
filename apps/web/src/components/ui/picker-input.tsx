import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";

type PickerType = "date" | "time" | "datetime-local" | "month" | "week";

interface PickerInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
	type: PickerType;
	icon?: LucideIcon;
	inputClassName?: string;
	iconClassName?: string;
	wrapperClassName?: string;
	onWrapperClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function PickerInput({
	type,
	icon: Icon,
	className,
	inputClassName,
	iconClassName,
	wrapperClassName,
	onWrapperClick,
	disabled,
	...props
}: PickerInputProps) {
	const openPickerFromWrapper = (wrapper: HTMLDivElement) => {
		if (disabled) return;
		const input = wrapper.querySelector("input");
		if (!(input instanceof HTMLInputElement)) return;
		openNativePicker(input);
	};

	return (
		<div
			className={cn("relative", wrapperClassName)}
			onClick={(event) => {
				onWrapperClick?.(event);
				openPickerFromWrapper(event.currentTarget);
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				openPickerFromWrapper(event.currentTarget);
			}}
		>
			<Input
				type={type}
				{...props}
				disabled={disabled}
				className={cn(
					"picker-input h-10 py-0 text-foreground leading-5",
					Icon && "pr-9",
					inputClassName,
					className,
				)}
			/>
			{Icon ? (
				<Icon
					className={cn(
						"pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
						disabled ? "text-muted-foreground/50" : "text-muted-foreground",
						iconClassName,
					)}
				/>
			) : null}
		</div>
	);
}

function openNativePicker(input: HTMLInputElement) {
	input.focus();
	const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
	pickerInput.showPicker?.();
}
