# Markdown File Template

Use this template when creating new markdown files to avoid common linting errors.

## Heading Format

Always use proper headings (##, ###) instead of bold text for section titles:

```markdown
## Section Title

Content goes here.
```

**Not:**
```markdown
**Section Title**
Content goes here.
```

## Blank Lines

### Headings

Always add blank lines before and after headings:

```markdown
## Section Title

Content here.

### Subsection

More content.
```

### Lists

Always add blank lines before and after lists:

```markdown
Here's a list:

- Item 1
- Item 2
- Item 3

More content after the list.
```

### Code Blocks

Always add blank lines before and after code blocks:

```markdown
Here's some code:

```typescript
const example = "code";
```

More content after the code block.
```

## Code Block Languages

Always specify a language for code blocks:

```markdown
```typescript
// TypeScript code
```

```bash
# Shell commands
```

```text
Plain text or formulas
```
```

## URLs

Always wrap URLs in angle brackets or markdown links:

```markdown
Visit <https://example.com> or [Example](https://example.com)
```

**Not:**
```markdown
Visit https://example.com
```

## Multiple Blank Lines

Never use more than one consecutive blank line:

```markdown
Paragraph 1.

Paragraph 2.
```

**Not:**
```markdown
Paragraph 1.


Paragraph 2.
```

## Complete Example

```markdown
# Document Title

## Introduction

This is an introduction paragraph.

## Main Content

### Subsection 1

Here's a list:

- First item
- Second item
- Third item

### Subsection 2

Here's some code:

```typescript
function example() {
  return "code";
}
```

### Subsection 3

Visit <https://example.com> for more information.

## Conclusion

Final thoughts here.
```

