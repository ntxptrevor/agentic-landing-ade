# LandingAI ADE Plugin for Claude Code

Interactive document extraction skill for [Claude Code](https://claude.com/claude-code) powered by [LandingAI's Agentic Document Extraction API](https://docs.landing.ai/ade/ade-overview).

## What it does

When you mention document parsing, PDF extraction, or structured data extraction, the skill activates and walks you through an interactive wizard:

1. **Collects your config** — API key, region (US/EU), operation type, output directory
2. **Executes the right API calls** — via `curl` commands, not Python scripts
3. **Builds schemas interactively** — define extraction fields one-by-one, generate from document content, or load from file
4. **Saves everything** — outputs, schemas, and split configs are saved for reuse
5. **Stays token-efficient** — never dumps large API responses into context; uses targeted `jq` queries

## Installation

### Step 1: Add the marketplace

```bash
claude plugin marketplace add jaewon42/agentic-landing-ade
```

### Step 2: Install the plugin

```bash
claude plugin install landing-ade
```

### Verify installation

```bash
claude plugin list
```

You should see `landing-ade` in the output.

## Other plugins in this marketplace

This marketplace also ships:

- **`bidforge-schedules`** — interactive construction WBS schedule generator
  (Gantt / list / calendar views, CPM scheduling, multi-format export).
- **`mygmc-smartcar`** — an MCP server that integrates a GMC / GM electric
  vehicle (e.g. a **2026 GMC Sierra EV**) through the
  [Smartcar API](https://smartcar.com/docs): battery, charging, location,
  odometer, tire pressure, and lock/unlock & start/stop-charge commands. See
  [`plugins/mygmc-smartcar/README.md`](plugins/mygmc-smartcar/README.md) for
  setup and OAuth instructions.

## Prerequisites

Before using the plugin, make sure you have:

1. **A LandingAI API key** — Sign up and get one at [va.landing.ai](https://va.landing.ai)
2. **`curl`** — Pre-installed on macOS/Linux
3. **`jq`** — Install with `brew install jq` (macOS) or `sudo apt install jq` (Linux)

## Quick Start

### 1. Parse a document

Just tell Claude:

```
Parse this PDF for me: ~/Documents/invoice.pdf
```

Claude will ask you for your API key (or use `VISION_AGENT_API_KEY` env var), region, and output directory — then run the parse and show you a summary.

### 2. Extract structured data

```
Extract the invoice number, date, and total from ~/Documents/invoice.pdf
```

Claude will:

1. Parse the document first (to get markdown)
2. Help you build a JSON schema — either interactively (field by field), by auto-generating from the parsed content, or by loading a saved schema file
3. Run the extraction and show the results

### 3. Split/classify a multi-document PDF

```
Split ~/Documents/bundle.pdf into bank statements and pay stubs
```

Claude will:

1. Parse the document
2. Walk you through defining split categories (name, description, optional identifier field)
3. Run the classification and show which pages belong to which category

### 4. Process large documents (50+ pages)

```
I have a 200-page PDF to process: ~/Documents/large-report.pdf
```

Claude will use the async Parse Job endpoint and optionally poll until complete.

## Operations

| Operation     | What it does                                                         |
| ------------- | -------------------------------------------------------------------- |
| **Parse**     | Convert PDF/image/spreadsheet to markdown + chunks                   |
| **Extract**   | Pull structured key-value fields from a document using a JSON schema |
| **Split**     | Classify/segment a multi-document PDF into categories                |
| **Parse Job** | Async parsing for large documents (50+ pages)                        |

## How the interactive wizard works

```
You: "Extract data from this PDF: ~/invoice.pdf"

Claude asks: What is your API key? (or type 'env' if VISION_AGENT_API_KEY is set)
You: env

Claude asks: Which region?
You: US

Claude asks: Where to save output files?
You: ./output

Claude: Parsing document...
Claude: Done! 3 pages, 12 chunks, 5 credits used.

Claude asks: How do you want to define your extraction schema?
  - Build interactively (field by field)
  - Generate from document (auto-detect fields)
  - Load from file

You: Generate from document

Claude: I found these fields in the document:
  - invoice_number (string)
  - date (string)
  - vendor_name (string)
  - total_amount (number)
  - line_items (array of objects)
Claude asks: Does this look right? Edit any fields, or accept?

You: Accept

Claude asks: Save this schema for reuse?
You: ./output/invoice_schema.json

Claude: Extracting...
Claude: Done! Results saved to ./output/extract_output.json
  invoice_number: INV-2024-001
  date: January 15, 2024
  vendor_name: Acme Corp
  total_amount: 1,234.56
  ...
```

## Schema reuse

Schemas and split configs are saved as JSON files. Reuse them on future documents:

```
Extract from ~/Documents/invoice2.pdf using the schema at ./output/invoice_schema.json
```

## Supported File Types

| Type         | Formats                                    |
| ------------ | ------------------------------------------ |
| Documents    | PDF, PNG, JPG, JPEG, TIFF, BMP, WEBP, HEIC |
| Spreadsheets | XLSX, CSV                                  |

## Regions

| Region | Base URL                              |
| ------ | ------------------------------------- |
| US     | `https://api.va.landing.ai`           |
| EU     | `https://api.va.eu-west-1.landing.ai` |

## Uninstalling

```bash
claude plugin uninstall landing-ade
claude plugin marketplace remove jaewon42-agentic-landing-ade
```

## License

MIT
