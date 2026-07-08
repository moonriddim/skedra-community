import { copyFileSync } from "node:fs";

copyFileSync("src/style.css", "dist/style.css");
copyFileSync("src/style.css.d.ts", "dist/style.css.d.ts");
copyFileSync("src/style.css.d.ts", "dist/style.d.css.ts");
