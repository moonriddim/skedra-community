# MCP launch demo board

The app includes the **AI product launch** template. It combines a native
Kanban plan and an editable Gantt timeline, making it a good starting point for
the public MCP demo.

## Golden demo prompt

```text
Create a board named “Skedra Beta Launch”. Add a Kanban board with Backlog,
In progress and Ready columns. Include tasks for the MCP landing page, docs,
registry submission, demo video, Founding User trial and analytics funnel.
Below it, create a three-week Gantt timeline using the same tasks and add the
dependencies needed for launch. Keep everything visually aligned.
```

Follow-up prompt:

```text
Move “MCP landing page” to Ready, set the demo video to 60% progress, and add a
launch-day milestone. Do not change unrelated elements.
```

## Board layout

- Top: one-sentence outcome and the “human + agent” promise.
- Middle: three-column Kanban board with six recognizable launch tasks.
- Bottom: Gantt chart covering three weeks with a visible milestone.
- Right edge: a small sticky note containing the follow-up prompt.
- Keep zoom at a level where the Kanban cards and Gantt labels remain readable.

## Proof points

1. The agent is using Skedra tools, not browser-coordinate automation.
2. New objects appear as editable native canvas elements.
3. A second prompt changes existing elements without rebuilding the board.
4. The browser reflects updates live.
5. End on the share view with “Made with Skedra” and “Use as template”.

Do not place real customer data, API keys, emails or private board links in the
recording board.
