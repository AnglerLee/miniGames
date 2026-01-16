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

## 4. UI/UX Standards
- **Minimalist Design**:
  - Remove unnecessary controls (e.g., "Hint" buttons) if they clutter the interface.
  - Focus on the core gameplay area.
- **Responsiveness**:
  - Ensure the game fits within a single screen on mobile devices without scrolling.
  - Use responsive grid layouts for game boards.
- **Timer Display**:
  - Center the timer at the top of the screen for visibility.
  - Use a large, readable font.
- **Themes**:
  - Support multiple themes (e.g., Default, Candy, Sky) configurable via Admin.
  - **Readability**: Use color palettes (gradients/solids) rather than complex pattern images for backgrounds to ensure game elements (like numbers or text) are clearly visible.
- **Modals**:
  - Replace native browser `alert()` and `confirm()` with custom, styled HTML modals for a consistent and premium feel.

## 5. Game Logic Standards
- **Time Limits**:
  - Implement a countdown timer for time-sensitive games.
- **Dynamic Retry Logic**:
  - If a user fails due to time, offer a "Retry" option that slightly eases the difficulty (e.g., adding +1 second to the time limit) to encourage persistence.
- **Persistence**:
  - Save "Best Records" or key states using `localStorage`.

## 6. Language & Localization
- **Primary Language**:
  - All user-facing text (UI, instructions, modals) and developer documentation (comments, commits, docs) must be written in **Korean**.

