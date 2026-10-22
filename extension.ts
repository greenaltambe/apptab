import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import Pango from "gi://Pango";
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
  private _container: St.BoxLayout;
  private _icon?: Clutter.Actor;

  constructor(window: Meta.Window, width: number) {
    super({
      styleClass: "panel-button", // Using the gnommes official classes for panel instead of me tyring to gues what color they use
      reactive: true,
      xExpand: true,
    });

    this._window = window;

    const container = new St.BoxLayout({
      styleClass: "app-tab-window-content",
      vertical: false,
      yAlign: Clutter.ActorAlign.CENTER,
    });

    // its natural size and gets centered inside the tab
    this.set_width(width);
    container.xAlign = Clutter.ActorAlign.CENTER;
    container.xExpand = true;

    this._container = container;
    this._updateIcon();
    for (const prop of ["notify::wm-class", "notify::gtk-application-id"]) {
      this._window.connectObject(prop, () => this._updateIcon(), this);
    }
    Shell.WindowTracker.get_default().connectObject(
      "tracked-windows-changed",
      () => this._updateIcon(),
      this,
    );

    const label = new St.Label({
      text: this._window.get_title() ?? "",
      yAlign: Clutter.ActorAlign.CENTER,
    });
    // long titles shrink with "…" instead of overflowing the fixed-width
    label.clutterText.ellipsize = Pango.EllipsizeMode.END;
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

  private _updateIcon() {
    const app = Shell.WindowTracker.get_default().get_window_app(this._window);
    if (!app) return;

    this._icon?.destroy();
    this._icon = app.create_icon_texture(24);
    this._icon.set_y_align(Clutter.ActorAlign.CENTER);
    this._container.insert_child_at_index(this._icon, 0);
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

  private _isAnimatingToVisible: boolean | null = null;
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
      () => this._setPanelVisible(false),
      "shown",
      () => this._setPanelVisible(false),
      "hiding",
      () => this._syncWithOverview(false),
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
    global.display.connectObject(
      "window-created",
      () => this._updateWindows(),
      "notify::focus-window",
      () => this._syncWithOverview(),
      "in-fullscreen-changed",
      () => this._syncWithOverview(),
      this,
    );

    global.workspaceManager.connectObject(
      "active-workspace-changed",
      () => this._updateWindows(),
      this,
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

    // Change the winodw order with window + shift + j or window + shift + k
    Main.wm.addKeybinding(
      "move-position-to-left",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => this._moveWindowPosition(-1),
    );
    Main.wm.addKeybinding(
      "move-position-to-right",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => this._moveWindowPosition(1),
    );
  }

  private _setPanelVisible(visible: boolean): void {
    if (this._isAnimatingToVisible === visible) return;

    this._isAnimatingToVisible = visible;

    if (visible) {
      // Make the actor visible before fading in.
      this.show();
      this.opacity = 0;
      this.translationY = 8;
    }

    this.ease({
      opacity: visible ? 255 : 0,
      translationY: visible ? 0 : 8,
      duration: 180,
      mode: visible
        ? Clutter.AnimationMode.EASE_OUT_CUBIC
        : Clutter.AnimationMode.EASE_IN_CUBIC,
      onComplete: () => {
        if (this._isAnimatingToVisible !== visible) return;

        if (!visible) {
          this.hide();
          this.translationY = 0;
        }
      },
    });
  }

  private _moveWindowPosition(step: number) {
    const n = this._windows.length;
    if (n === 0) return;

    const current = this._windows.findIndex((w) => w?.has_focus());
    if (current < 0) return; // nothing focused

    const newIndex = Math.min(n - 1, Math.max(0, current + step));
    if (newIndex === current) return; // no change

    const window = this._windows[current];
    if (!window) return;

    // Remove the window from its current position
    this._windows.splice(current, 1);
    // Insert the window at the new position
    this._windows.splice(newIndex, 0, window);

    // Update the windows in the panel
    this._updateWindows();
  }

  // The panel is visible only when there is something to list and the overview is closed.
  // `overviewVisible` can be passed explicitly since during "hiding" the overview still reports visible.
  private _syncWithOverview(overviewVisible = Main.overview.visible) {
    const currentlyFocusedWindow = global.display.focusWindow;
    if (
      overviewVisible ||
      this._windows.length === 0 ||
      (currentlyFocusedWindow && currentlyFocusedWindow.is_fullscreen())
    )
      this._setPanelVisible(false);
    else this._setPanelVisible(true);
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

    const listedTypes = [
      Meta.WindowType.NORMAL,
      Meta.WindowType.DIALOG,
      Meta.WindowType.MODAL_DIALOG,
    ];
    const current = allWindows.filter(
      (w): w is Meta.Window =>
        !!w &&
        w !== closing &&
        listedTypes.includes(w.get_window_type()) &&
        !w.is_skip_taskbar(),
    );

    const kept = this._windows.filter(
      (w): w is Meta.Window => !!w && current.includes(w),
    );

    const added = current
      .filter((w) => !kept.includes(w))
      .sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
    this._windows = [...kept, ...added];

    this._syncWithOverview();

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

    if (this._windows.length === 0) return;

    const width = Math.floor(this.get_width() / this._windows.length);
    for (const window of this._windows) {
      if (!window) continue;
      this.add_child(new WindowButton(window, width));
    }
  }
}

export default class AppTab extends Extension {
  gsettings: Gio.Settings | null = null;
  private _panel: St.BoxLayout | null = null;

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
    }
    this._panel = null;
    this.gsettings = null;

    Main.wm.removeKeybinding("focus-next-window");
    Main.wm.removeKeybinding("focus-previous-window");
    Main.wm.removeKeybinding("move-position-to-left");
    Main.wm.removeKeybinding("move-position-to-right");
  }
}
