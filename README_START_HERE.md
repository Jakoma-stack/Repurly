# Repurly unified workspace

This folder is designed to work for **both GitHub and ChatGPT execution**.

## How the pieces fit together

- The **repo root** is the working codebase you can put in GitHub.
- `docs/` contains the current strategy, execution, and decision materials.
- `_chatgpt/` contains the kickoff files for starting a fresh chat or project and giving ChatGPT the right context fast.


## Revision status
This workspace already includes the **10 execution task** revision pass for the narrow LinkedIn-first launch. Review `docs/execution/launch-scope-complete.md` for the summary of what changed.

## Best way to use this folder

### For GitHub
Use the **repo root** as your repository. Commit:
- application code
- `docs/`
- `.github/`
- `.gitignore`
- `.env.example`

Do not commit secrets or temporary local files.

### For a new ChatGPT project/chat
Upload this whole folder as a zip, then ask ChatGPT to read:
1. `_chatgpt/README_FIRST.md`
2. `_chatgpt/PROJECT_CONTEXT_BRIEF.md`
3. `_chatgpt/CHAT_KICKOFF_PROMPT.md`
4. `docs/decision/Repurly_revised_launch_decision_memo.docx`
5. `docs/decision/Repurly_revised_go_no_go_checklist.docx`

Then paste the kickoff prompt from `_chatgpt/CHAT_KICKOFF_PROMPT.md`.

## Recommended operating stance
- keep launch scope narrow
- prioritize workflow completion over more channels
- treat LinkedIn as the hero channel
- optimize for paid pilots, not feature breadth
- treat the richer delivery-logs build as the architecture base
- avoid drifting into a mini-Sprout strategy

## Key folders

- `_chatgpt/` — chat kickoff and context files
- `docs/decision/` — latest decision memo and go/no-go checklist
- `docs/project-management/` — board, gates, and execution scaffolding
- `docs/build-decisions/` — build-level decision notes
- `docs/archive-source/` — earlier memo and plan docs
- `docs/` (existing app docs) — product and platform implementation notes

## First actions
1. Create a new GitHub repo from this folder.
2. Review `docs/decision/` and `_chatgpt/PROJECT_CONTEXT_BRIEF.md`.
3. Create issues from `docs/project-management/github-project-board.md`.
4. Start execution against the narrow launch scope.
