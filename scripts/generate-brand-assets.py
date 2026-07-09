from __future__ import annotations

import json
import math
from base64 import b64encode
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "apps" / "web" / "public"
SOURCE = PUBLIC_DIR / "logo.png"

TEAL = (13, 188, 174, 255)
INK = (18, 32, 28, 255)
OFF_WHITE = (255, 254, 249, 255)
DARK = (13, 23, 20, 255)


def clamp(value: float, lower: int = 0, upper: int = 255) -> int:
	return max(lower, min(upper, int(round(value))))


def smoothstep(value: float) -> float:
	value = max(0.0, min(1.0, value))
	return value * value * (3.0 - 2.0 * value)


def remove_light_background(image: Image.Image) -> Image.Image:
	source = image.convert("RGBA")
	result = Image.new("RGBA", source.size)
	src_pixels = source.load()
	dst_pixels = result.load()

	transparent_threshold = 28.0
	opaque_threshold = 92.0

	for y in range(source.height):
		for x in range(source.width):
			r, g, b, _ = src_pixels[x, y]
			max_channel = max(r, g, b)
			min_channel = min(r, g, b)
			saturation = max_channel - min_channel
			distance_from_white = math.sqrt(
				(255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2
			)

			if saturation < 22:
				if max_channel > 236:
					alpha = 0
				elif max_channel > 86:
					alpha = clamp((255 - max_channel) * 1.55)
				else:
					alpha = 255
			else:
				coverage = smoothstep(
					(distance_from_white - transparent_threshold)
					/ (opaque_threshold - transparent_threshold)
				)
				alpha = clamp(coverage * 255)

			if alpha <= 2:
				dst_pixels[x, y] = (0, 0, 0, 0)
			else:
				if alpha < 255:
					coverage = alpha / 255.0
					r = clamp((r - 255 * (1 - coverage)) / coverage)
					g = clamp((g - 255 * (1 - coverage)) / coverage)
					b = clamp((b - 255 * (1 - coverage)) / coverage)
				dst_pixels[x, y] = (r, g, b, alpha)

	return result


def alpha_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int]:
	alpha = image.getchannel("A").point(lambda a: 255 if a > threshold else 0)
	bbox = alpha.getbbox()
	if bbox is None:
		raise ValueError("No visible logo content found after background removal.")
	return bbox


def make_square_mark(image: Image.Image, size: int = 1024, padding_ratio: float = 0.075) -> Image.Image:
	bbox = alpha_bbox(image)
	cropped = image.crop(bbox)
	content_size = max(cropped.width, cropped.height)
	padding = int(content_size * padding_ratio)
	canvas_size = content_size + padding * 2
	canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
	canvas.alpha_composite(
		cropped,
		((canvas_size - cropped.width) // 2, (canvas_size - cropped.height) // 2),
	)
	return canvas.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
	image.save(path, "PNG", optimize=True)


def alpha_silhouette(image: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
	result = Image.new("RGBA", image.size, color)
	result.putalpha(image.getchannel("A"))
	return result


def make_dark_background_mark(image: Image.Image) -> Image.Image:
	result = Image.new("RGBA", image.size)
	source_pixels = image.load()
	result_pixels = result.load()

	for y in range(image.height):
		for x in range(image.width):
			r, g, b, a = source_pixels[x, y]
			max_channel = max(r, g, b)
			min_channel = min(r, g, b)
			saturation = max_channel - min_channel

			if a > 0 and max_channel < 150 and saturation < 48:
				shade = max(0.0, min(1.0, max_channel / 150.0))
				result_pixels[x, y] = (
					clamp(OFF_WHITE[0] * (0.82 + shade * 0.18)),
					clamp(OFF_WHITE[1] * (0.82 + shade * 0.18)),
					clamp(OFF_WHITE[2] * (0.82 + shade * 0.18)),
					a,
				)
			else:
				result_pixels[x, y] = (r, g, b, a)

	return result


def composite_on_background(
	mark: Image.Image,
	size: int,
	background: tuple[int, int, int, int],
	padding_ratio: float = 0.11,
	glow: bool = False,
) -> Image.Image:
	canvas = Image.new("RGBA", (size, size), background)
	mark_size = int(size * (1.0 - padding_ratio * 2))
	resized = mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS)
	x = (size - mark_size) // 2
	y = (size - mark_size) // 2

	if glow:
		alpha = resized.getchannel("A").filter(ImageFilter.GaussianBlur(max(2, size // 64)))
		glow_layer = Image.new("RGBA", resized.size, (255, 254, 249, 115))
		glow_layer.putalpha(alpha.point(lambda a: min(115, a)))
		canvas.alpha_composite(glow_layer, (x, y))

	canvas.alpha_composite(resized, (x, y))
	return canvas


def make_icon(mark: Image.Image, size: int) -> Image.Image:
	canvas = Image.new("RGBA", (size, size), OFF_WHITE)
	mark_size = int(size * 0.82)
	resized = mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS)
	canvas.alpha_composite(resized, ((size - mark_size) // 2, (size - mark_size) // 2))
	return canvas


def make_transparent_icon(mark: Image.Image, size: int) -> Image.Image:
	canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
	mark_size = int(size * 0.88)
	resized = mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS)
	canvas.alpha_composite(resized, ((size - mark_size) // 2, (size - mark_size) // 2))
	return canvas


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
	candidates = [
		Path("C:/Windows/Fonts/segoeuib.ttf"),
		Path("C:/Windows/Fonts/segoeuisb.ttf"),
		Path("C:/Windows/Fonts/arialbd.ttf"),
		Path("C:/Windows/Fonts/arial.ttf"),
	]
	if not bold:
		candidates = [Path("C:/Windows/Fonts/segoeui.ttf"), *candidates]

	for path in candidates:
		if path.exists():
			return ImageFont.truetype(str(path), size=size)
	return ImageFont.load_default()


def paste_mark_with_glow(
	canvas: Image.Image,
	mark: Image.Image,
	position: tuple[int, int],
	glow_color: tuple[int, int, int, int],
) -> None:
	alpha = mark.getchannel("A").filter(ImageFilter.GaussianBlur(12))
	glow = Image.new("RGBA", mark.size, glow_color)
	glow.putalpha(alpha.point(lambda a: min(glow_color[3], a)))
	canvas.alpha_composite(glow, position)
	canvas.alpha_composite(mark, position)


def make_wordmark(mark: Image.Image, dark: bool) -> Image.Image:
	width, height = 1600, 500
	background = DARK if dark else OFF_WHITE
	text_color = OFF_WHITE if dark else INK
	canvas = Image.new("RGBA", (width, height), background)
	mark_render = mark.resize((310, 310), Image.Resampling.LANCZOS)
	mark_position = (130, 95)

	if dark:
		paste_mark_with_glow(canvas, mark_render, mark_position, (255, 254, 249, 92))
	else:
		canvas.alpha_composite(mark_render, mark_position)

	draw = ImageDraw.Draw(canvas)
	font = load_font(170)
	text = "Skedra"
	text_bbox = draw.textbbox((0, 0), text, font=font)
	text_height = text_bbox[3] - text_bbox[1]
	draw.text((500, (height - text_height) // 2 - 18), text, font=font, fill=text_color)
	return canvas


def make_og_image(mark: Image.Image) -> Image.Image:
	width, height = 1200, 630
	canvas = Image.new("RGBA", (width, height), (247, 251, 248, 255))
	draw = ImageDraw.Draw(canvas)

	for x in range(0, width, 48):
		draw.line((x, 0, x, height), fill=(13, 188, 174, 16), width=1)
	for y in range(0, height, 48):
		draw.line((0, y, width, y), fill=(13, 188, 174, 16), width=1)

	mark_render = mark.resize((350, 350), Image.Resampling.LANCZOS)
	canvas.alpha_composite(mark_render, (130, 140))

	title_font = load_font(150)
	draw.text((540, 180), "Skedra", font=title_font, fill=INK)
	draw.rounded_rectangle((545, 365, 865, 385), radius=10, fill=TEAL)
	return canvas


def write_manifest() -> None:
	manifest = {
		"name": "Skedra",
		"short_name": "Skedra",
		"icons": [
			{
				"src": "/android-chrome-192x192.png",
				"sizes": "192x192",
				"type": "image/png",
				"purpose": "any maskable",
			},
			{
				"src": "/android-chrome-512x512.png",
				"sizes": "512x512",
				"type": "image/png",
				"purpose": "any maskable",
			},
		],
		"theme_color": "#0f766e",
		"background_color": "#fffef9",
		"display": "standalone",
	}
	(PUBLIC_DIR / "site.webmanifest").write_text(
		json.dumps(manifest, indent="\t") + "\n",
		encoding="utf-8",
	)


def write_favicon_svg(mark: Image.Image) -> None:
	buffer = BytesIO()
	make_transparent_icon(mark, 64).save(buffer, "PNG", optimize=True)
	encoded = b64encode(buffer.getvalue()).decode("ascii")
	svg = (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
		'role="img" aria-label="Skedra">'
		f'<image width="64" height="64" href="data:image/png;base64,{encoded}"/>'
		"</svg>\n"
	)
	(PUBLIC_DIR / "favicon.svg").write_text(svg, encoding="utf-8")


def main() -> None:
	if not SOURCE.exists():
		raise FileNotFoundError(f"Logo source not found: {SOURCE}")

	source = Image.open(SOURCE)
	transparent = remove_light_background(source)
	mark = make_square_mark(transparent, 1024)
	mark_for_dark = make_dark_background_mark(mark)

	save_png(transparent, PUBLIC_DIR / "logo-transparent.png")
	save_png(mark, PUBLIC_DIR / "logo-mark-transparent.png")
	save_png(mark_for_dark, PUBLIC_DIR / "logo-mark-transparent-dark.png")
	mark.save(PUBLIC_DIR / "logo-mark-transparent.webp", "WEBP", quality=92, lossless=False)
	mark_for_dark.save(
		PUBLIC_DIR / "logo-mark-transparent-dark.webp",
		"WEBP",
		quality=92,
		lossless=False,
	)

	save_png(composite_on_background(mark, 1024, OFF_WHITE), PUBLIC_DIR / "logo-mark-on-light.png")
	save_png(composite_on_background(mark_for_dark, 1024, DARK, glow=True), PUBLIC_DIR / "logo-mark-on-dark.png")
	save_png(alpha_silhouette(mark, INK), PUBLIC_DIR / "logo-mark-mono-dark.png")
	save_png(alpha_silhouette(mark, OFF_WHITE), PUBLIC_DIR / "logo-mark-mono-light.png")
	save_png(make_wordmark(mark, dark=False), PUBLIC_DIR / "logo-wordmark-light.png")
	save_png(make_wordmark(mark_for_dark, dark=True), PUBLIC_DIR / "logo-wordmark-dark.png")
	save_png(make_og_image(mark), PUBLIC_DIR / "logo-og.png")

	for size, name in [
		(16, "favicon-16x16.png"),
		(32, "favicon-32x32.png"),
	]:
		save_png(make_transparent_icon(mark_for_dark, size), PUBLIC_DIR / name)

	for size, name in [
		(180, "apple-touch-icon.png"),
		(192, "android-chrome-192x192.png"),
		(512, "android-chrome-512x512.png"),
		(150, "mstile-150x150.png"),
	]:
		save_png(make_icon(mark, size), PUBLIC_DIR / name)

	ico_base = make_transparent_icon(mark_for_dark, 256)
	ico_base.save(
		PUBLIC_DIR / "favicon.ico",
		format="ICO",
		sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
	)
	write_favicon_svg(mark_for_dark)
	write_manifest()

	for path in sorted(PUBLIC_DIR.glob("*logo*")) + sorted(PUBLIC_DIR.glob("favicon*")):
		if path.is_file():
			print(path.relative_to(ROOT))
	print((PUBLIC_DIR / "site.webmanifest").relative_to(ROOT))


if __name__ == "__main__":
	main()
