export function canvasBlobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.readAsDataURL(blob);
	});
}

export function loadCanvasImageDimensions(
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

export function loadCanvasImageBlobDimensions(
	blob: Blob,
): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(blob);
	return loadCanvasImageDimensions(url).finally(() => URL.revokeObjectURL(url));
}
