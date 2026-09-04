# Code Quality Analyzer

MCP server for static code analysis. Reports findings with
severity levels and automated fix suggestions.

## Setup

```bash
cd tools/code-quality-server
npm install
```

## Register with Claude Code

```bash
claude mcp add code-quality -- node tools/code-quality-server/server.js
```

## Usage

Ask Claude to run a code quality analysis on the project. The tool
returns findings sorted by severity with specific fix instructions
for each issue.
