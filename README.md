# App Tab

**App Tab** is a GNOME Shell extension that brings i3-style horizontal window tabbing to the GNOME desktop.

The main goal was to make switching between windows in the current workspace faster while keeping all open windows visible, so one can easily see which windows are present without having to cycle through them as in alt tab.

Tested on **GNOME 50**.

## Features

- **Window overview:** Displays a panel at the bottom of the screen containing all windows in the current workspace, with an option to show windows from all workspaces.
- **Click to focus:** Click a window's tab in the panel to bring that window into focus.
- **Keyboard shortcuts:** Quickly switch between windows and move windows around using keyboard shortcuts.

## Recommended Extensions and Configuration

I recommend using App Tab alongside the [Space Bar](https://extensions.gnome.org/extension/5090/space-bar/) GNOME extension. Space Bar makes it easier to switch between workspaces and move windows across workspaces using keyboard shortcuts.

### Fixing Workspace Switching Shortcuts

You may encounter an issue where pressing `Super + 1`, `Super + 2`, and so on launches or switches to applications instead of changing workspaces.

To fix this, disable the conflicting GNOME Shell application-switching shortcuts:

1. Open **Dconf Editor**.
2. Navigate to `org.gnome.shell.keybindings`.
3. Find the key named `switch-to-application-1`.
4. Change its value from:

   ```text
   ['<Super>1']
   ```

   to:

   ```text
   []
   ```

5. Repeat this for the other `switch-to-application-*` keys that conflict with your workspace shortcuts.

This frees the `Super + number` shortcuts for workspace switching, provided they are configured by Space Bar or another extension.

## Build and Install

### Prerequisites

Make sure the following tools are installed:

- `pnpm`
- `zip`
- `glib-compile-schemas`

### Install the Extension

Run the following command from the project directory:

```sh
make install
```

This builds the extension, packages it into `apptab.zip`, and installs it.

Enable the extension with:

```sh
gnome-extensions enable apptab@greenaltambe@github.com
```

**Note for Wayland users:** After making code changes, log out of your GNOME session and log back in to load the updated extension code.

### Other Make Targets

| Command        | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `make install` | Builds, packages, and installs the extension.                              |
| `make pack`    | Builds and packages the extension into `apptab.zip` without installing it. |
| `make clean`   | Removes generated build output.                                            |

## TODO

- **Panel position:** Add a setting to display the window panel at the top of the screen instead of the bottom, maybe add it into GNOME's existing top bar.
- **Default fullscreen mode:** Add an option to open applications in fullscreen mode by default.
- **Vertical tabs:** Add an option to arrange tabs vertically, similar to Sway or i3. (I will not add this most probably).
- **Reorder tabs:** Allow users to reorder tabs by dragging them or using keyboard shortcuts. Keyboard shortcuts for reordering already exist; drag-and-drop support has not been implemented.
- **Close windows:** Add a button to close windows directly from the panel.
