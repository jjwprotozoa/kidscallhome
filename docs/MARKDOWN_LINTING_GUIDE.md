# Markdown Linting Guide

This guide explains how to prevent and fix markdown linting errors in this project.

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **VS Code will auto-format on save** (already configured in `.vscode/settings.json`)

3. **Check all markdown files:**
   ```bash
   npm run lint:md
   ```

4. **Auto-fix issues:**
   ```bash
   npm run lint:md:fix
   ```

## Configuration Files

- **`.markdownlint.json`** - Main configuration file with all rules
- **`.vscode/settings.json`** - Auto-format on save for markdown files
- **`docs/MARKDOWN_TEMPLATE.md`** - Template for creating new markdown files

## Common Rules

### MD022 - Headings Need Blank Lines

**Error:** Headings should be surrounded by blank lines

**Fix:**
```markdown
## Heading

Content here.
```

**Not:**
```markdown
## Heading
Content here.
```

### MD032 - Lists Need Blank Lines

**Error:** Lists should be surrounded by blank lines

**Fix:**
```markdown
Here's a list:

- Item 1
- Item 2
```

**Not:**
```markdown
Here's a list:
- Item 1
- Item 2
```

### MD031 - Code Blocks Need Blank Lines

**Error:** Fenced code blocks should be surrounded by blank lines

**Fix:**
```markdown
Here's code:

```typescript
const x = 1;
```

More content.
```

**Not:**
```markdown
Here's code:
```typescript
const x = 1;
```
More content.
```

### MD040 - Code Blocks Need Language

**Error:** Fenced code blocks should have a language specified

**Fix:**
```markdown
```typescript
const x = 1;
```
```

**Not:**
```markdown
```
const x = 1;
```
```

### MD036 - Use Headings, Not Bold

**Error:** Emphasis used instead of a heading

**Fix:**
```markdown
## Section Title
```

**Not:**
```markdown
**Section Title**
```

### MD034 - Wrap URLs

**Error:** Bare URL used

**Fix:**
```markdown
Visit <https://example.com> or [Example](https://example.com)
```

**Not:**
```markdown
Visit https://example.com
```

### MD012 - No Multiple Blank Lines

**Error:** Multiple consecutive blank lines

**Fix:**
```markdown
Paragraph 1.

Paragraph 2.
```

**Not:**
```markdown
Paragraph 1.


Paragraph 2.
```

## Using the Template

When creating a new markdown file, copy from `docs/MARKDOWN_TEMPLATE.md` to ensure proper formatting.

## VS Code Integration

The project is configured to:
- Auto-format markdown files on save
- Show linting errors in real-time
- Use the `.markdownlint.json` configuration

Make sure you have the **markdownlint** extension installed in VS Code:
- Extension ID: `DavidAnson.vscode-markdownlint`

## Pre-commit Hook (Optional)

To automatically check markdown files before committing, you can add a pre-commit hook:

```bash
# In .git/hooks/pre-commit (or use husky)
npm run lint:md
```

## Troubleshooting

### Errors Still Appearing After Fix

1. Save the file (triggers auto-format)
2. Run `npm run lint:md:fix` to auto-fix issues
3. Manually check the specific rule in `.markdownlint.json`

### VS Code Not Auto-formatting

1. Ensure the markdownlint extension is installed
2. Check `.vscode/settings.json` has the markdown formatting settings
3. Reload VS Code window

### CLI Not Working

1. Ensure `markdownlint-cli` is installed: `npm install`
2. Check that `.markdownlint.json` exists in the project root
3. Run from the project root directory








