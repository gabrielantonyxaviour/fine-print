# Scope for Bob in this repo

- The "Abel product development" block in AGENTS.md is for other tools. Ignore it and never run `.abel/graph` commands.
- Work from the task brief you are given (docs/build/*.md). Do not read spec.json.
- Never put these words in a file, folder or test name: password, secret, credential, token, apikey, api_key, api-key, config.json. `.bobignore` hides such paths from you.
- Keep every file under 300 lines. No console.log in library code (src/). Validate external input with zod.
- Do not commit. Gabriel reviews each task first.
