import { z } from "zod";

// Homogeneous array items work with Codex's schema parser; tuple items do not.
// Keep exactly two coordinates and the canonical tuple type after validation.
export const mcpCanvasPointsSchema = z
	.array(
		z
			.array(z.number())
			.length(2)
			.transform((point): [number, number] => [point[0], point[1]]),
	)
	.min(2);
