import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const editorCss = readFileSync("../canvas-editor/src/style.css", "utf8");
const sdkCss = readFileSync("src/style.css", "utf8").replace(
	/^@import "@skedra\/canvas-editor\/style\.css";\r?\n\r?\n/u,
	"",
);
writeFileSync("dist/style.css", `${editorCss.trim()}\n\n${sdkCss}`);
copyFileSync("src/style.css.d.ts", "dist/style.css.d.ts");
copyFileSync("src/style.css.d.ts", "dist/style.d.css.ts");
