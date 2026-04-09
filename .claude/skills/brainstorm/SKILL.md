---
name: brainstorm
description: Deep research and ideation on a problem before planning. Produces a structured brainstorm with options, tradeoffs, a recommendation, and a build strategy saved under .claude/docs/brainstorms/.
argument-hint: "[topic or problem to brainstorm]"
---

# Brainstorm

Use this skill when the problem is still fuzzy, the solution space is broad, or you want to compare approaches before locking a plan.

## Step 1: Build Context

Read the relevant project context first:

- `PROJECT_BRIEF.md`
- `.claude/docs/ARCHITECTURE.md`
- `.claude/docs/PLAN.md` if it exists
- `.claude/docs/HANDOFF.md` if it exists
- `.claude/docs/knowledge/lessons.md` if it exists
- Relevant files under `.claude/docs/decisions/`
- Any project docs or source files that materially affect the problem

If the local context leaves important gaps, use available research tools to close them.

## Step 2: Generate Options

Produce multiple distinct ideas that address the problem.

- Include the obvious path and at least one meaningful alternative when possible.
- Ground the ideas in the current repo, not generic advice.
- Call out assumptions explicitly.

## Step 3: Evaluate Tradeoffs

For each option, write concrete pros and cons.

- Tie the tradeoffs back to this project's current architecture and constraints.
- Call out delivery cost, verification cost, migration risk, and likely failure modes.

## Step 4: Recommend

Choose the best option or a narrow combination of options.

- Explain why it wins.
- Note what would change the recommendation.
- State whether the follow-on work fits Ralph mode, manual mode, or a hybrid.

## Step 5: Save the Brainstorm

Write the full result to:

`.claude/docs/brainstorms/YYYY-MM-DD-topic.md`

Use this structure:

```markdown
# Brainstorm: [Topic]
**Date**: [YYYY-MM-DD]
**Problem**: [One-sentence restatement]

## Ideas

### 1. [Idea name]
[Description]
- **Pros**: ...
- **Cons**: ...

### 2. [Idea name]
...

## Recommendation
[Best idea or combination, with reasoning]

## Sources
- [Project docs read]
- [Relevant code inspected]
- [External sources if used]
```

## Step 6: Append Build Strategy

After saving the brainstorm, append:

```markdown
## Build Strategy

### Module Dependencies
[Key modules/components and how they depend on each other]

### Build Order
[Recommended implementation order, including any parallelizable work]

### Testing Pyramid
- **Unit tests**: ...
- **Integration tests**: ...
- **E2E tests**: ...

### Risk Mitigation Mapping
- Risk: [description] -> Mitigation: [strategy]

### Recommended Build Mode
- **Ralph Mode** / **Manual Mode** / **Hybrid**
- [Why]
```

## Output Rules

- Save the brainstorm before summarizing it to the user.
- End by pointing to the saved file path.
- If the next step is clear, recommend `/ralph-plan` using the saved brainstorm as context.
- Do not implement code in this skill.
