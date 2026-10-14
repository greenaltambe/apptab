import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import St from "gi://St";
import GObject from "gi://GObject";

// This class will be the button that will be added to the panel for each window
class WindowButton extends St.Button {
  static {
    GObject.registerClass(this);
  }

  private _window: Meta.Window;

  constructor(window: Meta.Window) {
    super({
      styleClass: "panel-button", // Using the gnommes official classes for panel instead of me tyring to gues what color they use
      reactive: true,
      xExpand: true,
    });

    this._window = window;

    const container = new St.BoxLayout({
      vertical: false,
      yAlign: Clutter.ActorAlign.CENTER,
    });

    const tracker = Shell.WindowTracker.get_default();
    const app = tracker.get_window_app(this._window);
    if (app) {
      const icon = app.create_icon_texture(24);
      icon.set_y_align(Clutter.ActorAlign.CENTER);
      container.add_child(icon);
    }
    const label = new St.Label({
      text: this._window.get_title() ?? "",
      yAlign: Clutter.ActorAlign.CENTER,
    });
    // titles are often empty at creation time, so keep the label in sync
    this._window.connectObject(
      "notify::title",
      () => label.set_text(this._window.get_title() ?? ""),
      this,
    );

    container.add_child(label);

    this.set_child(container);
    this.connectObject(
      "clicked",
      () => {
        if (this._window) {
          this._window.activate(global.get_current_time());
        }
      },
      this,
    );

    // keep the checked state in sync with the window's focus state
    this._syncFocus();
    global.display.connectObject(
      "notify::focus-window",
      () => this._syncFocus(),
      this,
    );
  }

  private _syncFocus() {
    // checked is the Shell's "selected" look for panel buttons
    this.checked = this._window.has_focus();
  }
}

// This class will be the panel that will appear at the bottom or top of the screen
// TODO() : Add settings to control the panel position, right now it will be at the bottom of screen
class Panel extends St.BoxLayout {
  static {
    GObject.registerClass(this); // this is required to make the c - libs know that this exists
  }

  private _settings: Gio.Settings; // this will be the settings obj that will be passed as a parameter to the constructor of the panel class
  private _watched = new Set<Meta.Window>(); // windows we already listen to for "unmanaged"
  private _windows: (Meta.Window | null)[]; // this will be the list of windows that will be displayed in the panel

  constructor(settings: Gio.Settings) {
    super({
      name: "panel",
      styleClass: "panel",
      reactive: true,
    });
    this._settings = settings;
    this._windows = [];

    // Add the panel to the bottom of the screen
    Main.layoutManager.addChrome(this, {
      affectsStruts: true,
      trackFullscreen: true,
    });

    this._redrawPanel();

    // in the Panel constructor, replacing the one-off `if (Main.overview.visible)` check
    if (Main.layoutManager._startingUp) {
      Main.layoutManager.connectObject(
        "startup-complete",
        () => this._syncWithOverview(),
        this,
      );
    }
    this._syncWithOverview();

    // Hide it while the overview is open and show it again when it closes.
    // A gesture (3 finger swipe) may not emit "showing" the same way as the
    // keyboard/hot corner, so also sync on "shown"/"hidden", which always fire.
    Main.overview.connectObject(
      "showing",
      () => this.hide(),
      "shown",
      () => this.hide(),
      "hiding",
      () => this.show(),
      "hidden",
      () => this._syncWithOverview(),
      this,
    );

    Main.layoutManager.connectObject(
      "monitors-changed",
      () => this._redrawPanel(),
      this,
    );

    // Update the windows when a new window is created
    global.display.connectObject("window-created", () => this._updateWindows());

    global.workspaceManager.connectObject("active-workspace-changed", () =>
      this._updateWindows(),
    );

    // Updae the focused window when keyboar window + j or window + k is pressed
    Main.wm.addKeybinding(
      "focus-next-window",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => this._focusNextWindow(),
    );
    Main.wm.addKeybinding(
      "focus-previous-window",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => this._focusPreviousWindow(),
    );
  }

  private _syncWithOverview() {
    if (Main.overview.visible) this.hide();
    else this.show();
  }

  private _focusWindow(window: Meta.Window) {
    if (!window) return;
    window.activate(global.get_current_time());
  }

  // Move focus by `step` windows (1 = next, -1 = previous), clamped to the list.
  // The focused index is looked up on every call so it can never be stale.
  private _cycleFocus(step: number) {
    const n = this._windows.length;
    if (n === 0) return;

    const current = this._windows.findIndex((w) => w?.has_focus());
    // nothing focused (e.g. desktop): start from the first/last window
    // stop at the first/last window instead of wrapping around
    const index =
      current >= 0
        ? Math.min(n - 1, Math.max(0, current + step))
        : step > 0
          ? 0
          : n - 1;

    const target = this._windows[index];
    if (target) this._focusWindow(target);
  }

  private _focusNextWindow() {
    this._cycleFocus(1);
  }

  private _focusPreviousWindow() {
    this._cycleFocus(-1);
  }

  // This function draws the panel on the screen at the bottom (later at top) of screen
  private _redrawPanel() {
    const m = Main.layoutManager.primaryMonitor;
    if (!m) return;

    const panel_height = this._settings.get_int("panel-height");
    this.set_position(m.x, m.y + m.height - panel_height);
    this.set_size(m.width, panel_height);
    this._updateWindows();
  }

  private _updateWindows(closing?: Meta.Window) {
    this.destroy_all_children();

    // only real application windows, not the desktop, docks or popups
    let allWindows = [];

    // check for settings if to show all from all workspaces or only from current workspace
    if (this._settings.get_boolean("show-all-windows")) {
      // Show all windows from all workspaces
      allWindows = global.get_window_actors().map((actor) => actor.metaWindow);
    } else {
      // Show only windows from the current workspace
      allWindows = global
        .get_window_actors()
        .map((actor) => actor.metaWindow)
        .filter(
          (window) =>
            window?.get_workspace() ===
            global.workspaceManager.get_active_workspace(),
        );
    }

    const current = allWindows.filter(
      (w): w is Meta.Window =>
        !!w && w !== closing && w.get_window_type() === Meta.WindowType.NORMAL,
    );

    const kept = this._windows.filter(
      (w): w is Meta.Window => !!w && current.includes(w),
    );

    const added = current
      .filter((w) => !kept.includes(w))
      .sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
    this._windows = [...kept, ...added];

    for (const window of this._windows) {
      if (!window || this._watched.has(window)) continue;
      this._watched.add(window);
      // "unmanaged" fires while the window is still in the actor list,
      // so tell _updateWindows to leave it out
      window.connectObject(
        "unmanaged",
        () => {
          this._watched.delete(window);
          this._updateWindows(window);
        },
        this,
      );
    }

    for (const window of this._windows) {
      if (!window) continue;
      this.add_child(new WindowButton(window));
    }
  }
}

export default class AppTab extends Extension {
  gsettings?: Gio.Settings;
  private _panel?: St.BoxLayout;

  enable(): void {
    // initialize settings first
    this.gsettings = this.getSettings();

    // make panel at the bottom of screen
    this._panel = new Panel(this.gsettings);
  }

  disable(): void {
    if (this._panel) {
      Main.layoutManager.removeChrome(this._panel);
      this._panel.destroy();
      this._panel = undefined;
    }
    this.gsettings = undefined;

    Main.wm.removeKeybinding("focus-next-window");
    Main.wm.removeKeybinding("focus-previous-window");
  }
}
