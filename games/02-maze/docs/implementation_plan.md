# Implementation Plan: Maze Game Improvements

## Goal Description
Enhance the existing "02-maze" prototype by adding difficulty levels with diverse maps, a time limit system, and a dynamic difficulty adjustment mechanism (time extension on retry). Also, introduce an Admin settings page for game configuration.

## User Review Required
- **Map Generation**: Maps will be pre-generated strings or arrays stored in JSON. Logic for generation will be basic DFS or Prim's algorithm.
- **Time Limits**: Default time limits will be proposed (e.g., Easy: 30s, Normal: 60s, Hard: 90s).

## Proposed Changes

### Assets
#### [NEW] [maps.json](file:///d:/Angler/miniGames/games/02-maze/maps.json)
- Check structure:
```json
{
  "easy": [ ...20 maps... ],
  "normal": [ ...20 maps... ],
  "hard": [ ...20 maps... ]
}
```
- Maps represented as 2D arrays (0: path, 1: wall).

### Game Logic
#### [game.js](file:///d:/Angler/miniGames/games/02-maze/game.js)
- **Map Loading**: Fetch `maps.json` and load random map based on selected difficulty.
- **Timer System**:
    - Add `timeLimit` variable.
    - Add timer interval/animation loop check.
    - Display timer in UI.
- **Retry Logic**:
    - Track `retryCount` for current level.
    - If `Time Over` -> `retryCount++`.
    - `currentLevelTime + (retryCount * 1)`.
- **Admin Integration**: Load settings from `localStorage`.

### Admin Interface
#### [NEW] [admin.html](file:///d:/Angler/miniGames/games/02-maze/admin.html)
- Standard admin layout.
- Settings:
    - Base Time Limit (Easy, Normal, Hard).
    - Map Selection (Optional: specific map index for testing).

#### [NEW] [admin.js](file:///d:/Angler/miniGames/games/02-maze/admin.js)
- Handle saving/loading settings to `localStorage`.

### UI
#### [index.html](file:///d:/Angler/miniGames/games/02-maze/index.html)
- Add Timer display element.
- Add Difficulty selector (or handle via Admin/Settings, but usually players pick difficulty).
    - *Clarification*: Should the player pick difficulty or the admin? Usually Admin sets config, User plays. But "Difficulty" is often a user choice.
    - *Decision*: User chooses difficulty on start (or sequential). I will implement a "Level Select" or "Difficulty Select" modal or screen at start.

## Verification Plan

### Automated Tests
- **Map Generator Script**: Run generating script Node.js or browser console to verify JSON output structure.

### Manual Verification
1. **Map Variety**: Play multiple times, verify different maps load.
2. **Timer**: Let time run out, verify Game Over.
3. **Retry Mechanic**: Fail by time, retry, verify timer is Initial + 1s.
4. **Admin**: Change base time in Admin, verify applied in Game.
