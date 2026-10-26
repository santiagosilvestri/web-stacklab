# Stacklab

An interactive `push_swap` visualizer for learning stack operations, experimenting with sorting strategies, and replaying instruction sequences.

Stacklab uses two stacks, **A** and **B**, and the eleven standard `push_swap` operations. It runs entirely in the browser with plain HTML, CSS, and JavaScript—no installation, build step, framework, or external service required.

## Live demo

**[Open Stacklab](https://santiagosilvestri.github.io/stacklab/)**

Copy and paste this address into your browser:

```text
https://santiagosilvestri.github.io/stacklab/
```

*The link becomes available once the repository is published with GitHub Pages enabled.*

## Features

- **Practice mode:** manipulate the stacks manually using operation buttons or drag and drop, with undo and a navigable operation history. Designed for up to 30 numbers.
- **Replay mode:** paste operations or import a `.txt` file via drag and drop or the file picker, then play, pause, step through, or jump to any operation. Supports up to 500 numbers and 100,000 instructions.
- **Playback controls:** adjustable speed from `0.5×` to `1000×`, timeline navigation, and one-click replay from the beginning after the final step.
- **Number generator:** quick sizes of 3, 5, 10, 30, 100, or 500; custom size, range, optional seed, and an optional disorder percentage based on inversions.
- **Three visualizations:** values, normalized indices, and binary indices for up to 30 numbers. With 31 or more, Stacklab automatically switches to compact bars and hides the unnecessary view selector.
- **Stack B orientation:** switch between **Alineado** (default, both stacks aligned to the left) and **Espejado** (stack B bars aligned toward the center). Available in both Practice and Replay modes, including large stacks.
- **Copy and paste workflow:** copy the initial numbers for your local executable, then paste the resulting operations into Stacklab.
- **Built-in examples:** verified 5-number and 10-number solutions.
- **Validation:** detects invalid or repeated numbers, unsupported instructions, ineffective moves, and whether stack A is sorted with stack B empty.
- **Responsive interface:** adapts from small phones and tablets to wide desktop monitors, enlarging the stacks and playback timeline when space allows. Includes reduced-motion support.

## How to use

### Practice manually

1. Open **Practicar**.
2. Enter a list of unique integers or generate a random exercise.
3. Use the stack-operation buttons or drag tiles to experiment.
4. Review the operation history, undo moves, and try a different approach.

### Visualize your own `push_swap` solution

1. Generate or enter numbers in Stacklab and click **Cargar números** if you typed them manually.
2. Click the copy icon next to the initial-number field.
3. Run your compiled `push_swap` executable with those numbers as command-line arguments. For example:

   ```bash
   ./push_swap 8 3 10 1 6 2 9 5 7 4
   ```

4. Copy the instructions printed by your program (such as `pb`, `ra`, `pa`, etc.), or save them to a text file:

   ```bash
   ./push_swap 8 3 10 1 6 2 9 5 7 4 > operations.txt
   ```

5. Open **Reproducir**, then either paste the instructions and click **Cargar operaciones**, drop `operations.txt` onto the operations editor, or select **Cargar TXT**. Files are validated and loaded automatically.
6. Press Play or use the timeline to examine the solution. Stacklab shows whether the final state is sorted.

Stacklab visualizes instructions; it does **not** run your local C executable or generate a sorting solution for arbitrary inputs. A correctly sorted input may produce an empty instruction sequence.

## Supported operations

| Operation | Action |
| --- | --- |
| `sa`, `sb`, `ss` | Swap the top two elements of A, B, or both. |
| `pa`, `pb` | Push the top element from B to A, or from A to B. |
| `ra`, `rb`, `rr` | Rotate A, B, or both (top element moves to the bottom). |
| `rra`, `rrb`, `rrr` | Reverse-rotate A, B, or both (bottom element moves to the top). |

## Run locally

Download or clone the repository and open `index.html` in a modern browser. All files work directly from disk; no local server is required.

```text
stacklab/
├── index.html    # Page structure
├── styles.css    # Layout, colors, responsive styles and animations
├── app.js        # Stack operations, state, generator and playback
└── README.md     # Documentation
```

To publish the website, place these four files in the **root of the `main` branch** of the `stacklab` repository and enable **Settings → Pages → Deploy from a branch → main / (root)**.

## Technical notes

- Supported numbers are unique signed 32-bit integers (`-2147483648` to `2147483647`).
- Manual manipulation is intended for at most 30 numbers; larger generated sets automatically use Replay mode.
- The disorder percentage is based on the number of inverted pairs, not on randomly selected swaps.
- `1×` playback corresponds to two operations per second. Faster modes batch visual updates while still applying every instruction in order.
- No analytics, backend, persistent storage, or third-party libraries are required.

## TXT import and safety

- Import a single `.txt` file through **Cargar TXT** or drag it onto the operations text area. Pasting text remains supported.
- **Limit:** 100,000 operations per sequence, whether pasted or imported. A TXT file or pasted text is limited to **1 MiB**, which is sufficient for 100,000 newline-separated `rrr` commands even with CRLF line endings.
- Only the eleven `push_swap` instructions are accepted (blank lines, extra whitespace, separators, and `#` comments are permitted). Invalid instructions reject the entire import.
- Validation happens **before** updating the editor or active sequence. A rejected file leaves the previous sequence intact.
- Files are read locally in the browser; no content is uploaded or executed as code.
- Load the same initial numbers used by your program before importing the operations file.
