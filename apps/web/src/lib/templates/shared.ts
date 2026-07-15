import { translate } from "@/lib/i18n";
import { getCurrentLocale } from "@/stores/locale";

/** Web-only localization adapter for the canonical canvas-core templates. */
export function templateText(key: string) {
	return translate(getCurrentLocale(), `templateContent.${key}`);
}
