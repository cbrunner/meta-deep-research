# Fix: Report Styling Not Showing in Main View

## Problem

The Consensus Report renders correctly in the **History panel** but not on the **main completion page** after research finishes.

## Root Cause

Looking at the code, the History panel uses this pattern (which works):
```jsx
<div className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none">
  <ReactMarkdown>{selectedItem.consensus_report}</ReactMarkdown>
</div>
```

But `ReportContainer.tsx` tries to create a light-themed report (`bg-white`, `prose-slate`) inside the dark-themed app. This causes style conflicts because:

1. The app wrapper uses dark backgrounds and light text
2. `ReportContainer` tries to invert this with white backgrounds
3. The `dark:` variants don't activate properly because there's no dark mode class toggle

## Solution

Update the three report components to use **dark theme styling** (matching the history panel approach):

### 1. ReportRenderer.tsx

Change the prose classes from:
- `prose prose-slate lg:prose-lg dark:prose-invert` 

To:
- `prose prose-invert lg:prose-lg`

Update all the color modifiers to use dark-appropriate colors:
- Headings: `text-gray-100`, `text-gray-200`
- Body text: `text-gray-300`
- Links: `text-blue-400` (not `text-blue-600`)
- Borders: `border-gray-600` (not `border-slate-200`)
- Blockquote background: `bg-indigo-500/10` with `text-indigo-200`
- Code inline: `bg-gray-800 text-pink-400`
- Tables: `bg-gray-800` header, `border-gray-600` borders

### 2. ReportContainer.tsx

Change the main content wrapper from light to dark:
- Header: Keep the gradient, it already works
- Main content area: Change from `bg-white` to `bg-gray-700`
- Footer: Change from `bg-slate-100` to `bg-gray-800`
- Remove all `dark:` conditional classes since we're always dark

### 3. CitationList.tsx

Update to dark theme colors:
- Background: `bg-gray-800` for items
- Text: `text-gray-100` for headings, `text-gray-400` for secondary text
- Links: `text-blue-400`
- Agent badges: Use the existing color scheme but with `/20` opacity backgrounds

## After Making Changes

1. Rebuild: `cd client && npm run build`
2. Restart the server
3. Hard refresh the browser (Ctrl+Shift+R)

## Expected Result

The Consensus Report on the main page should look identical to how it appears in the History panel - properly styled dark theme with:
- Clear heading hierarchy
- Styled blockquotes with indigo accent
- Syntax-highlighted code blocks
- Properly styled tables
- Blue links with external link icons
- Formatted citation list with agent badges
