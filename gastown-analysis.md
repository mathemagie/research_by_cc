# Gas Town — Multi-Agent Workspace Manager

**Repository:** [github.com/steveyegge/gastown](https://github.com/steveyegge/gastown)
**Author:** Steve Yegge
**Language:** Go (primary), Shell, JavaScript, Python
**Stars:** 12,153
**Created:** December 2024

---

## What is Gas Town?

Gas Town (`gt`) is an orchestration system that lets you coordinate **multiple AI coding agents** (Claude Code, Codex, Gemini, Cursor, etc.) working on different tasks in the same workspace. It solves the chaos that happens when you try to run 4-10+ agents without coordination.

Without it, multiple agents step on each other's files, lose context on restart, and have no way to communicate. Gas Town provides:

- **Persistent state** — work survives agent restarts via git-backed hooks
- **Agent identity & mailboxes** — agents can hand off work and communicate
- **Scalable coordination** — comfortably manage 20-30 agents vs. chaos at 4-10

---

## Core Concepts

| Concept      | What it is                                                  |
| ------------ | ----------------------------------------------------------- |
| **Mayor**    | Your primary AI coordinator with full workspace context     |
| **Town**     | The workspace directory (e.g. `~/gt/`)                      |
| **Rigs**     | Project containers wrapping git repos                       |
| **Polecats** | Worker agents with persistent identity but ephemeral sessions |
| **Hooks**    | Git worktree-based persistent storage                       |
| **Convoys**  | Work tracking units (like epics) bundling multiple beads    |
| **Beads**    | Git-backed issues (e.g. `gt-abc12`)                         |

---

## Installation

### Prerequisites

- Go 1.23+
- Git 2.25+ (worktree support)
- Dolt 1.82.4+
- Beads (bd) 0.55.4+
- SQLite3
- tmux 3.0+ (recommended)
- Claude Code CLI or Codex CLI

### Install Methods

```bash
# Homebrew (recommended)
brew install gastown

# npm
npm install -g @gastown/gt

# From source
go install github.com/steveyegge/gastown/cmd/gt@latest
```

Docker Compose is also available with environment variables for Git credentials and folder mounting.

---

## Quick Start

```bash
gt install ~/gt --git    # Create a town (workspace)
cd ~/gt
gt mayor attach          # Start the Mayor (your coordinator agent)
```

Then tell the Mayor what to build. It creates convoys, spins up worker agents, and orchestrates everything.

---

## Key Commands

| Category      | Commands                                          |
| ------------- | ------------------------------------------------- |
| **Workspace** | `gt install`, `gt rig add`, `gt crew add`         |
| **Agents**    | `gt agents`, `gt sling`, `gt mayor attach`, `gt feed` |
| **Convoys**   | `gt convoy create`, `gt convoy list`, `gt convoy add` |

Built-in agent presets: `claude`, `gemini`, `codex`, `cursor`, `auggie`, and others.

---

## Workflows

### 1. Mayor Workflow (recommended)

Tell the Mayor what to build. It creates convoys and orchestrates agents automatically. Best for most use cases.

### 2. Minimal Mode

Run individual agent instances manually. Gas Town tracks state via `gt convoy` commands — you stay in control of each agent.

### 3. Beads Formula Workflow

Use predefined TOML-defined processes for repeatable, multi-step tasks (e.g., one agent researches, one codes, one reviews, one tests).

---

## How You Can Use It

### Solo dev scaling

Describe a feature to the Mayor. It breaks it into tasks, assigns them to parallel agents, and merges the results. Great for ambitious refactors or multi-file features.

### Multi-agent pipelines

Set up repeatable workflows where agents handle different stages of your development process in sequence or parallel.

### Multi-model orchestration

Mix Claude, Gemini, Codex, etc. as workers. Each agent type has built-in presets:

```bash
gt sling claude
gt sling codex
gt sling gemini
```

### Manual coordination

If you prefer more control, run agents yourself and use `gt convoy` to track state. Gas Town handles persistence and coordination even without the Mayor.

---

## Configuration

- Per-rig runtime settings stored in `settings/config.json`
- Claude uses hooks in `.claude/settings.json` for mail injection and startup
- Beads ledger provides structured state persistence across all agents

---

## Summary

Gas Town is particularly useful if you are already using Claude Code (or similar AI coding tools) and want to **scale beyond a single agent session** for larger projects. It turns the messy reality of running multiple AI agents into a structured, persistent, and coordinated workflow.
