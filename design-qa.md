# Design QA — canvas-wide visual clipboard actions

- Source visual truth: `C:\Users\simon\AppData\Local\Temp\codex-clipboard-25f07f7d-2cae-4866-8985-f4b0a5691b7c.png`
- Implementation screenshot: `C:\Users\simon\.codex\visualizations\2026\07\23\019f8f4d-d268-7832-bbf2-ba48b30d2f3c\skedra-copy-menu-full.png`
- Focused implementation crop: `C:\Users\simon\.codex\visualizations\2026\07\23\019f8f4d-d268-7832-bbf2-ba48b30d2f3c\skedra-copy-menu-focused-fixed.png`
- Combined comparison: `C:\Users\simon\.codex\visualizations\2026\07\23\019f8f4d-d268-7832-bbf2-ba48b30d2f3c\skedra-copy-menu-comparison.png`
- Browser viewport: 1280 × 720 CSS px at device scale factor 1.
- Pixel dimensions: source 346 × 246; full implementation 1280 × 720; focused implementation 260 × 357. The source and focused implementation were compared at original pixel density in one side-by-side artifact.
- State: German locale, dark theme, guest canvas with a structured Gantt board, no element selection, and the empty-canvas context menu open.
- Full-view comparison evidence: the browser-rendered full canvas confirms that the context menu stays within the viewport, clears persistent controls, and opens at the right-click position.
- Focused-region comparison evidence: the source and implementation menus were combined side by side so labels, action order, shortcuts, separators, typography, icons, and density are directly legible.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested visual-clipboard scope.
- Information architecture: Paste remains first, the new PNG and SVG clipboard actions follow it, and Select all remains in the next separated group. Existing Skedra formatting, snapping, and grid actions remain below the reference actions.
- Fonts and typography: the implementation uses Skedra's established compact application font, 12 px menu text, muted 10 px shortcut labels, and current optical weights. The longer German labels wrap without clipping.
- Spacing and layout rhythm: the 252 px menu width, 30 px minimum rows, 10 px icon gap, grouped separators, rounded corners, and viewport clamping follow the shared Skedra context-menu system. The reference's four-action rhythm is preserved at the top of the menu.
- Colors and visual tokens: the reference is light-theme Excalidraw, while the implementation intentionally uses the active Skedra dark-theme surface, border, muted text, focus, and elevation tokens. Contrast remains clear in enabled and disabled states.
- Image quality and asset fidelity: the reference contains no custom image asset. The new actions use the project's existing Lucide icon system, and PNG export now safely rasterizes boards containing HTML-backed structured elements instead of producing a tainted canvas.
- Copy and content: German and English labels match the requested PNG/SVG semantics. `Shift+Alt+C`, `Ctrl+V`, and `Ctrl+A` are visible in the same action order as the reference.
- Accessibility: both actions are native menuitems with accessible names; the PNG shortcut works without opening the menu, and read-only canvases may still copy visual output.
- Primary interactions tested: open the empty-canvas menu by right-click, copy the complete board as PNG, copy it as SVG, invoke PNG copy with `Shift+Alt+C`, and run Select all. Clipboard failures surface a localized alert.
- Browser console: no warnings or errors after the structured-content PNG fix; both PNG entry points and the SVG action completed without a dialog.

## Comparison history

1. The initial browser pass exposed a P1 functional failure on structured boards: Gantt and other `foreignObject` content tainted the intermediate canvas, so PNG clipboard copy raised a security error.
2. PNG rasterization now uses an origin-safe SVG data URL when exported content contains `foreignObject`, while simpler SVGs keep the object-URL path.
3. The post-fix browser pass copied the structured board through both the menu and `Shift+Alt+C` with no alert or console error. SVG copy and Select all also passed, and the final focused comparison shows the requested actions in the expected order.

## Follow-up polish

- P3: a future pass could add a non-modal success toast after clipboard writes; the current implementation only shows feedback when copying fails.

final result: passed

---

# Design QA — library removed from the canvas toolbar

- Source visual truth: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\toolbar-library-before.png`
- Implementation screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\toolbar-library-after.png`
- Combined comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\toolbar-library-comparison.png`
- Focused toolbar comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\toolbar-library-focused-comparison.png`
- Browser viewport: 1280 × 720
- State: German locale, dark theme, guest canvas with the same Kanban content and closed workspace panel before and after the change.
- Full-view comparison evidence: the browser-rendered source and implementation were combined side by side at the same viewport and application state.
- Focused-region comparison evidence: the top toolbar was cropped from both screenshots and combined at original scale so the removed Library action and the preserved surrounding controls are directly legible.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested toolbar scope.
- Information architecture: the standalone Shape Library action is no longer present in the top canvas toolbar. Library remains available through the dedicated Library tab in the unified workspace panel.
- Interaction state: opening the workspace panel and selecting Library still renders the existing Libraries and Create sections. The Insert & Templates toolbar menu no longer receives a misleading active state while Library is open.
- Fonts and typography: unchanged; removing the icon-only action introduces no new text or wrapping.
- Spacing and layout rhythm: the toolbar contracts by one compact action while preserving its existing padding, separator positions, icon spacing, radius, and centered alignment.
- Colors and visual tokens: the remaining controls retain the existing semantic border, surface, muted, hover, selected, and focus tokens.
- Image quality and asset fidelity: no raster assets are involved. The removed control used the existing Lucide BookOpen icon; all remaining controls continue to use the project's established icon set.
- Copy and content: Library copy remains available in the panel tab and library content. No user-facing label was removed from the only remaining access path.
- Primary interactions tested: confirm Shape Library is absent from the toolbar, open the unified workspace panel, select Library, render the empty-library state, and close the panel again.
- Browser console: no warnings or errors during the interaction check.

## Comparison history

1. The source capture showed Shape Library as a standalone top-toolbar action in addition to the Library tab in the workspace panel.
2. The implementation removes only that duplicate toolbar action and its unrelated Insert & Templates active-state condition.
3. The same-state full and focused comparisons show a clean toolbar with no layout break, while browser interaction confirms the panel-based Library flow remains functional.

final result: passed

---

# Design QA — plain-language sequence diagram builder

- Source visual truth: `C:\Users\simon\.codex\generated_images\019f70bb-d3a6-78d3-afb8-fa27c3db380a\exec-2b58c10a-a82b-4f2c-98fd-4333829669a1.png`
- Implementation screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\sequence-builder-implementation.png`
- Full-view comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\sequence-builder-comparison.png`
- Focused panel comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\sequence-builder-panel-comparison.png`
- Focused quick-composer comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\sequence-builder-quick-comparison.png`
- Browser viewport: 1487 × 1058, matching the source visual exactly.
- State: German locale, dark theme, guest canvas, three-participant order flow selected, second step in edit mode, condition fragment visible, and the on-canvas quick composer filled with `Service → API: Daten speichern`.
- Full-view comparison evidence: source and implementation were combined side by side at identical dimensions. The side-panel/diagram/composer hierarchy, dark surface treatment, teal primary action, participant chips, editable steps, and on-canvas continuation prompt are all present.
- Focused-region comparison evidence: the full panel and quick composer were cropped from both artifacts and paired at original scale because their typography, icon alignment, inputs, and state controls were too small to judge reliably in the full-width comparison alone.

## Findings

- No actionable P0, P1, or P2 issues remain.
- Information architecture: natural-language recognition is the default path; manual participants, step editing, conditions/repetitions, and Mermaid are progressively disclosed instead of competing in one form.
- Fonts and typography: the diagram retains Skedra's hand-drawn display type. Controls intentionally use the product's established application font rather than copying the concept's display font into form UI; sizes and row heights were increased during QA for scanability without breaking host consistency.
- Spacing and layout rhythm: the panel uses the full available desktop height, the inserted diagram is offset into the unobscured canvas region, and the quick prompt/composer sit beneath the interaction flow without covering persistent app controls.
- Colors and visual tokens: panel surfaces, borders, muted text, focus rings, selected rows, disabled controls, and primary actions use the existing dark-theme semantic tokens. The teal action hierarchy matches the source intent.
- Image quality and asset fidelity: the implementation needs no raster imagery. Visible icons use the project's Lucide library and diagram marks use existing canvas primitives; no placeholder images, handcrafted SVGs, emoji, or CSS illustration substitutes were introduced.
- Copy and content: the default example, recognition feedback, participants, steps, condition/repetition language, quick prompt, and advanced Mermaid path are coherent in German and have English translations. The two-line default description matches the concept's reading rhythm.
- Icons and affordances: edit, delete, save, cancel, participant, condition, repetition, return, and continuation actions are visible, consistently sized, and use semantic buttons.
- Accessibility: all fields have accessible names, icon-only actions have labels, native buttons/selects/inputs are keyboard reachable, and focus-visible treatment follows the existing teal focus token.
- Responsive behavior: at 560 × 800 the panel becomes a contained bottom workspace with a scrollable body, persistent footer action, compact toolbar, and hidden quick composer; no controls overlap or leave the viewport.
- Primary interactions tested: open the insert menu, recognize the default description, add a manual step, add a condition, insert the diagram, add a step from the quick composer, edit it, delete it, switch to Mermaid and back, and reselect an existing diagram for continued editing.
- Browser console: no warnings or errors during the complete interaction pass.

## Comparison history

1. Initial browser evidence in `C:\Users\simon\Documents\Code Projekte\Skedra\.tmp-sequence-builder-qa.png` exposed a P1 layout problem: automatic fitting centered the new diagram under the open panel, hiding the customer lifeline and message origins. Insertion now reserves 240 px for the panel and keeps the diagram at 100%; the final full-view comparison shows all three participants unobscured.
2. The first active-diagram condition pass exposed a P2 collision between the fragment label and the first message. Wrapped flow elements now move down far enough to reserve a labeled fragment header, with a core regression assertion; the final screenshot shows clear separation.
3. The first focused comparison exposed P2 density drift and a missing source affordance. Panel type, row heights, CTA size, and the two-line example were enlarged, and the dashed `Was passiert als Nächstes?` on-canvas prompt was restored above the quick composer. The final focused comparisons show the revised hierarchy and readable controls.

## Follow-up polish

- P3: the concept uses distinct decorative icons for different system participants, while the implementation deliberately keeps Skedra's shared Lucide participant icon language.

final result: passed

---

# Design QA — dynamic Gantt editor

- Source visual truth: `C:\Users\simon\AppData\Local\Packages\MicrosoftWindows.Client.Core_cw5n1h2txyewy\TempState\ScreenClip\{DD7705D1-86FB-4B85-AE41-2BF7DFBA772D}.png`
- Interaction reference: `C:\Users\simon\AppData\Local\Packages\MicrosoftWindows.Client.Core_cw5n1h2txyewy\TempState\ScreenClip\{7601E5EC-0EBC-4189-8F35-A4F1D8F718E3}.png`
- Implementation screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\gantt-dynamic-editor-final.png`
- Browser viewport: 1280 × 720
- State: German locale, dark theme, Gantt panel open on the Timeline tab, 37-day project range, 44 px/day, Today marker enabled, an edited critical task, and an added Go-live milestone.
- Full-view comparison evidence: both supplied references and the browser-rendered implementation were opened together at original resolution. The implementation retains Skedra's current dark hand-drawn timeline while adding the editable tool controls and project-planning states from the Excalidraw reference.
- Focused-region comparison evidence: the open editor panel and selected timeline remain visible in the final capture so scale controls, date range, Today marker, task bars, milestone diamonds, and dependency routing can be judged in one state.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested dynamic-Gantt scope.
- Information architecture: the tool is split into Tasks, Dependencies, and Timeline instead of exposing all project controls in one long form.
- Editing model: names, owners, dates, durations, status, colors, progress, critical-path state, milestones, project range, row height, and horizontal scale are editable before explicitly updating the canvas.
- Dependencies: finish-to-start, start-to-start, finish-to-finish, and start-to-finish are available. Adding and removing links updates the rendered connector graph.
- Canvas behavior: task bars remain directly movable and resizable. Their geometry is folded back into the canonical Gantt document when the editor is reopened.
- Fonts and typography: canvas labels retain the existing Skedra hand-drawn style; editor controls use the established compact application typography.
- Spacing and layout rhythm: the 420 px tool panel uses the existing overlay pattern and stays usable at 1280 × 720. Timeline controls have consistent field spacing and reachable footer actions.
- Colors and visual tokens: the editor follows the existing semantic dark-theme tokens. Today uses red, milestones use orange, and critical work uses the dashed red treatment from the reference.
- Image quality and asset fidelity: no raster or placeholder assets were introduced. Existing canvas primitives and Lucide icons render all interactive states.
- Primary interactions tested: insert a Gantt chart, rename a task, change progress, mark it critical, add and rename a milestone, add a start-to-finish dependency, extend the date range, increase horizontal scale, and update the canvas.
- Browser console: no warnings or errors were present during the functional interaction pass.

## Comparison history

1. The first pass auto-fitted the entire chart after every update, which visually cancelled deliberate scale changes and reduced the viewport to 59%.
2. Apply-time auto-fit was removed while initial insertion still fits the new chart once.
3. The final browser check changed the scale to 44 px/day and extended the project to 37 days. Zoom stayed at 100% before and after applying; the final comparison was then manually set to 51% for a readable full-chart QA capture.

final result: passed

---

# Design QA — activity history in the unified workspace panel

- Source visual truth: `C:\Users\simon\AppData\Local\Packages\MicrosoftWindows.Client.Core_cw5n1h2txyewy\TempState\ScreenClip\{18870296-15D4-4385-A909-84CB87BED0E7}.png`
- Implementation screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\workspace-panel-activity-474x486.png`
- Combined comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\design-qa\workspace-panel-activity-comparison.png`
- Browser viewport: 474 × 486
- State: German locale, dark theme, authenticated cloud board, unified workspace panel open on Activity History. The board contains one realistic creation event generated through the local application.
- Full-view comparison evidence: reference and browser-rendered implementation were combined side by side at original resolution.
- Focused-region comparison evidence: the complete 474 × 486 source and implementation views keep the header, panel tabs, activity card, and compact canvas toolbar legible, so a second crop was not needed.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested activity-history/panel scope.
- Information architecture: Activity History is a conditional fifth tab beside Search, Library, Comments, and Presentation. The separate History button is removed from the normal cloud-board header; one generic launcher continues to open the complete workspace panel.
- Permissions and data loading: the tab appears only for users who can view activity, and its query is enabled only while the workspace panel is open or the legacy overlay is explicitly used.
- Share and presentation placement: Share remains a compact panel-header action and presentation preparation remains in the Presentation tab, keeping unrelated wide actions out of the canvas header.
- Fonts and typography: the existing Skedra Outfit/system stack, weights, and text hierarchy are unchanged.
- Spacing and layout rhythm: five compact icon tabs, Share, and Close remain visible without clipping at the reference viewport. The activity title, description, and event card use the same vertical rhythm as the adjacent panel modes.
- Colors and visual tokens: selected, hover, border, surface, and focus states use the existing semantic teal/dark-theme tokens.
- Image quality and asset fidelity: no raster assets are required. History uses the project's existing Lucide icon library and the existing activity-event icons; no custom SVG or placeholder asset was introduced.
- Copy and content: German and English accessible labels were added for Activity History. The embedded content reuses the existing board name, actor, action, and timestamp copy.
- Responsive behavior: at 474 × 486 the panel stays inside the viewport, all five tabs and both header actions remain visible, and the compact canvas toolbar clears the panel.
- Primary interactions tested: create a local board, open the single workspace launcher, select Activity History, render the board-created event, close the panel, reopen it with Activity still selected, and confirm the canvas remains usable.
- Browser console: no warnings or errors during the interaction check.

## Comparison history

1. The source showed Activity History as a separate top-row button while Comments, Share, and Prepare Presentation also occupied the header.
2. The implementation places Activity History inside the existing workspace tab strip and leaves only the generic panel launcher in the board header.
3. The authenticated board capture verified real activity data, the active-tab state, and the close/reopen flow at the same 474 × 486 viewport without a crash or clipped controls.

final result: passed

---

# Design QA — visual sequence diagram builder

- Source visual truth: `C:\Users\simon\AppData\Local\Packages\MicrosoftWindows.Client.Core_cw5n1h2txyewy\TempState\ScreenClip\{B4C257F0-BAEF-4933-98DD-33037B2363B7}.png`
- Implementation screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\sequence-diagram\checkout-diagram-pass2-1196x796.png`
- Combined comparison: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\sequence-diagram\source-vs-checkout-comparison.png`
- Visual builder screenshot: `C:\Users\simon\Documents\Code Projekte\Skedra\.codex-artifacts\sequence-diagram\visual-builder-panel-1196x796.png`
- Browser viewport: 1196 × 796
- State: German locale, dark theme, visual builder opened from the canvas insert menu, then the Checkout preset inserted on a clean canvas region.
- Full-view comparison evidence: the source and browser-rendered implementation were combined side by side at original resolution.
- Focused-region comparison evidence: the complete visual builder panel was captured separately so its presets, tabs, controls, labels, and primary actions could be checked at readable scale.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested graphical sequence-diagram scope.
- Visual structure: the result contains an actor, participant headers, dashed lifelines, synchronous and return messages, activation bars, and an `alt` fragment with an `else` divider.
- Information architecture: the panel opens on the graphical builder. Mermaid remains available as a secondary import tab.
- Fonts and typography: participant names, message labels, fragment labels, and panel copy follow the existing Skedra typography tokens.
- Spacing and layout rhythm: lifelines use an even horizontal rhythm, message rows have stable vertical separation, and activation bars stay aligned with their participants.
- Colors and visual tokens: the diagram adapts to the existing dark theme while preserving the reference hierarchy through light participant headers, dashed lifelines, pink activations, and a translucent fragment region.
- Image quality and asset fidelity: the actor and interaction controls use the project's existing canvas primitives and Lucide icon library; no placeholder asset, custom SVG, or raster approximation was introduced.
- Copy and content: German and English labels exist for the visual builder, presets, participants, message types, activations, fragments, and Mermaid import.
- Primary interactions tested: open the insert menu, open Sequence Diagram, verify the visual tab is the default, insert the Checkout example, close the panel, and inspect the generated diagram.
- Browser console: no warnings or errors during the interaction check.

## Comparison history

1. The first insertion landed over existing local canvas content, causing visible overlap in `checkout-diagram-pass1-1196x796.png`.
2. The canvas was moved to a clean region and the preset inserted again.
3. The second side-by-side comparison confirmed that the overlap was removed and that all primary sequence-diagram symbols remained readable and aligned.

## Follow-up polish

- P3: the bundled Checkout example is semantically equivalent to the reference but intentionally uses the product's current theme and concise sample copy rather than reproducing every source label verbatim.

final result: passed
