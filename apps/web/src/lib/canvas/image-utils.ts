/**
 * Hilfsfunktionen fuer Bild-Upload im Canvas und in Kanban-Dialogen.
 */

export interface PickedImage {
	src: string;
	width: number;
	height: number;
	name: string;
}

export function fitImageSize(
	width: number,
	height: number,
	maxWidth: number,
	maxHeight: number,
): { width: number; height: number } {
	if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
	const scale = Math.min(maxWidth / width, maxHeight / height, 1);
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
}

export async function pickImageFile(): Promise<PickedImage | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.style.display = "none";
		document.body.appendChild(input);

		const cleanup = () => {
			input.value = "";
			document.body.removeChild(input);
		};

		input.addEventListener(
			"change",
			async () => {
				const file = input.files?.[0];
				if (!file) {
					cleanup();
					resolve(null);
					return;
				}

				try {
					const result = await readImageFile(file);
					cleanup();
					resolve(result);
				} catch {
					cleanup();
					resolve(null);
				}
			},
			{ once: true },
		);

		input.click();
	});
}

export async function pickImageFiles(): Promise<PickedImage[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = true;
		input.style.display = "none";
		document.body.appendChild(input);

		const cleanup = () => {
			input.value = "";
			document.body.removeChild(input);
		};

		input.addEventListener(
			"change",
			async () => {
				const files = Array.from(input.files ?? []);
				if (files.length === 0) {
					cleanup();
					resolve([]);
					return;
				}

				try {
					const result = await Promise.all(
						files.map((file) => readImageFile(file)),
					);
					cleanup();
					resolve(result);
				} catch {
					cleanup();
					resolve([]);
				}
			},
			{ once: true },
		);

		input.click();
	});
}

async function readImageFile(file: File): Promise<PickedImage> {
	const src = await fileToDataUrl(file);
	const dimensions = await loadImageDimensions(src);
	return {
		src,
		width: dimensions.width,
		height: dimensions.height,
		name: file.name,
	};
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.readAsDataURL(file);
	});
}

function loadImageDimensions(
	src: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = reject;
		image.src = src;
	});
}
