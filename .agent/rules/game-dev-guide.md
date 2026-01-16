---
trigger: always_on
glob: "**/*"
description: "Core rules and guidelines for game development tasks."
---

# Game Development & Agent Rules

This document outlines the mandatory rules and workflows for the coding agent when working on game projects.

## 1. Documentation Management
- **Location**: All documentation (planning, implementation, workflows, etc.) must be saved in a `docs` folder located immediately under the specific task's or game's directory.
  - Example: `games/02-maze/docs/`
- **Requirement**: No documents should be placed in the root unless they are global project documentations.

## 2. Architecture & File Structure
- **Separation of Concerns**: 
  - The **Game Main Page** (gameplay) and the **Settings/Admin Page** must be separate files/interfaces.
  - Do not combine admin controls directly into the gameplay view unless specifically requested for debugging overlays (but main settings should still be separate).

## 3. Administrator Mode (Settings)
- **Purpose**: The Admin mode is primarily for adjusting the game's difficulty and behavior.
- **Variables**: It must expose variables that control the general difficulty (e.g., speed, time limits, sensitivity).
- **Persistence**: 
  - Use `localStorage` to save all Admin settings.
  - Ensure settings are cached and restored on the device so the game retains its configuration across reloads.
