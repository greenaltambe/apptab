# App Tab

A GNOME Shell extension that adds a taskbar-style panel at the bottom of the primary monitor. It shows one button (icon and title) per open window, and the focused window is highlighted.

Targets GNOME Shell 50.

## Features

- A button for each normal application window; click to activate it.
- The focused window's button is highlighted, using the Shell's own panel styling.
- Button order stays stable and doesn't follow stacking order. New windows go at the end.
- The panel hides while the overview is open.
- Keyboard shortcuts to move focus to the next or previous window. They stop at the first and last window instead of wrapping.

## Settings

| Setting               | Default   | Description                                               |
| --------------------- | --------- | --------------------------------------------------------- |
| Panel height          | 32        | Height of the panel in pixels                             |
| Show all windows      | off       | Show windows from all workspaces, not only the active one |
| Focus next window     | `Super+J` | Focus the next window in the panel                        |
| Focus previous window | `Super+K` | Focus the previous window in the panel                    |

## Build and install

Requires `pnpm`, `zip` and `glib-compile-schemas`.

```sh
make install   # builds, packs apptab.zip and installs it
```

Then enable it with `gnome-extensions enable apptab@greenaltambe@github.com`. On Wayland you need to log out and back in for code changes to load.

Other targets: `make pack` builds only the zip, and `make clean` removes build output.

## Todo

1. Add a setting to show the panel on top of the screen instead of the bottom. (Most probably to add in the gnomes top panel itself).
2. Add a setting to open apps in full screen by default.
3. Add a setting to make tabs vertical like sway/i3. (Most probably will not happen).
4. Make the tabs in the panel draggable or add keyboard shortcut to reorder.
5. Add button to close tabs/windows.
