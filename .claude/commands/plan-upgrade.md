---
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*)
argument-hint: <conversion, token, parser, exporter, or tool goal>
description: Plan an AI-design.tools capability from Design IR and invariants before editing files.
---

Plan: $ARGUMENTS

Return source/target contract, Design IR impact, deterministic algorithm, confidence/lossiness model, performance/security constraints, task graph, tests/golden fixtures, MCP exposure, migration/rollback, and provenance. Do not edit files.
