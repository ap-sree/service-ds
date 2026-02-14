# AI Coding Assistant Rules

These rules must be followed in every interaction.

## 1. Coding Standards (Java)
- **Clean Imports**: ALWAYS use standard imports (e.g., `import jakarta.validation.Valid;`) at the top of the file. NEVER use fully qualified names (e.g., `@jakarta.validation.Valid`) inside method signatures or class bodies unless absolutely necessary to avoid conflicts.
- **Import Placement**: Ensure all `import` statements are strictly at the top of the file, before the class definition. Never paste imports inside the class body.

## 2. Task Execution & Verification
- **Comprehensive Audits**: When requested to perform a "global" change or update "all" files, you MUST first list every single affected file and track them individually. Do not assume completion based on a subset.
- **Verification First**: Do not mark a task as "Completed" or "Done" in `task.md` until you have verified the change in *every* target file.
- **Explicit Status**: If a task is partially done, clearly state "Partially Complete" and list what remains.

## 3. Communication
- **Honesty**: Do not claim to have analyzed the "entire" codebase unless you have actually run search tools to cover the full scope.
