# LogicCubes Reference Guide

LogicCubes is a visual scripting system that allows you to create game logic without writing code. You connect cubes together to create chains of actions and reactions.

## 🧩 Trigger Cubes
Start execution chains when events occur.

### On Click
**Description:** Triggers when the entity is clicked by the player.
- **Inputs:** None
- **Outputs:** `On Click` (Fires when clicked)
- **Parameters:**
  - `Cooldown`: Minimum time between triggers (seconds)

### On Timer
**Description:** Fires repeatedly at a specified interval.
- **Inputs:** None (Can be reset via internal signals)
- **Outputs:** `On Timer` (Fires every interval)
- **Parameters:**
  - `Interval`: Time between triggers (seconds)
  - `Auto Start`: Start timer automatically (boolean)

### On Game Start
**Description:** Fires once when the game starts.
- **Inputs:** None
- **Outputs:** `On Start` (Fires when game starts)
- **Parameters:**
  - `Delay`: Delay before triggering (seconds)

### On Player Enter
**Description:** Triggers when a player enters the detection zone.
- **Inputs:** None
- **Outputs:** `On Enter` (Fires when player enters)
- **Parameters:**
  - `Detection Radius`: Radius of the zone (units)

### On Player Leave
**Description:** Triggers when a player leaves the detection zone.
- **Inputs:** None
- **Outputs:** `On Leave` (Fires when player leaves)
- **Parameters:**
  - `Detection Radius`: Radius of the zone (units)

### On Interact
**Description:** Triggers when player interacts with this entity (e.g. presses 'E').
- **Inputs:** `Trigger` (Receives interaction signal)
- **Outputs:** `On Interact` (Fires when interacted with)
- **Parameters:**
  - `Cooldown`: Minimum time between triggers (seconds)

---

## ⚡ Action Cubes
Perform actions when triggered.

### Send Message
**Description:** Sends a message to the global event bus.
- **Inputs:** `Trigger`
- **Outputs:** `Complete` (Fires after message is sent)
- **Parameters:**
  - `Message`: Event name to send
  - `Data`: JSON data to send with event

### Set Variable
**Description:** Sets a variable to a specific value.
- **Inputs:** `Trigger`, `Value` (Optional override)
- **Outputs:** `Complete` (Fires after variable is set)
- **Parameters:**
  - `Variable Name`: Name of the variable
  - `Value`: Default value to set
  - `Type`: Value type (Number, String, Boolean)

### Spawn Entity
**Description:** Spawns a new entity into the world.
- **Inputs:** `Trigger`
- **Outputs:** `Complete` (Fires after spawn)
- **Parameters:**
  - `Prefab Name`: Name of entity template to spawn
  - `Offset X/Y/Z`: Position offset from spawner

### Destroy Entity
**Description:** Destroys this or another entity.
- **Inputs:** `Trigger`
- **Outputs:** None
- **Parameters:**
  - `Target`: Self or Other

### Log Message
**Description:** Logs a message to the browser console (for debugging).
- **Inputs:** `Trigger`
- **Outputs:** `Complete`
- **Parameters:**
  - `Message`: Text to log

---

## ❓ Condition Cubes
Evaluate conditions and route signals (If/Else).

### Compare Variable
**Description:** Compares a variable to a value.
- **Inputs:** `Trigger`
- **Outputs:** 
  - `True`: Condition is met
  - `False`: Condition is not met
- **Parameters:**
  - `Variable Name`: Variable to check
  - `Operator`: Equal, Not Equal, Greater, Less, etc.
  - `Compare Value`: Value to compare against

### Is Player Near
**Description:** Checks if player is within a specific range.
- **Inputs:** `Trigger`
- **Outputs:** `True`, `False`
- **Parameters:**
  - `Detection Radius`: Range to check

### Check Distance
**Description:** Checks distance between entities.
- **Inputs:** `Trigger`
- **Outputs:** `True`, `False`
- **Parameters:**
  - `Distance`: Distance threshold
  - `Operator`: Less Than, Greater Than

---

## 💾 Data Cubes
Store and manipulate data values.

### Variable
**Description:** Stores a persistent value.
- **Inputs:** `Set`, `Get`
- **Outputs:** 
  - `Value`: Current value (Data signal)
  - `On Set`: Fires when value changes
- **Parameters:**
  - `Name`: Variable identifier
  - `Initial Value`: Starting value

### Counter
**Description:** Keeps a count that can be incremented/decremented.
- **Inputs:** `Increment`, `Decrement`, `Reset`
- **Outputs:** 
  - `Value`: Current count
  - `On Change`: Fires when count changes
- **Parameters:**
  - `Initial Value`: Starting count
  - `Step`: Amount to change by

### Timer
**Description:** Tracks elapsed time.
- **Inputs:** `Start`, `Stop`, `Reset`
- **Outputs:** 
  - `Elapsed`: Time in seconds
  - `On Complete`: Fires when duration reached
- **Parameters:**
  - `Duration`: Target time (seconds)
  - `Auto Start`: Start automatically

---

## 🚪 Logic Gates
Perform boolean logic operations.

### AND Gate
**Description:** Outputs only when ALL inputs are triggered.
- **Inputs:** `Input A`, `Input B`
- **Outputs:** `Output`
- **Parameters:** `Reset After Output`

### OR Gate
**Description:** Outputs when ANY input is triggered.
- **Inputs:** `Input A`, `Input B`
- **Outputs:** `Output`

### NOT Gate
**Description:** Inverts the signal (checks if input was NOT triggered).
- **Inputs:** `Input`, `Check`
- **Outputs:** `Output`

### Delay
**Description:** Delays a signal by a specified time.
- **Inputs:** `Input`
- **Outputs:** `Output`
- **Parameters:** `Delay` (seconds)

