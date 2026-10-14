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
      styleClass: "app-tab-window-button",
      reactive: true,
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
      styleClass: "app-tab-window-label",
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
          this.add_style_class_name("focused-window-button");
        }
      },
      this,
    );
  }
}

// This class will be the panel that will appear at the bottom or top of the screen
// TODO() : Add settings to control the panel position, right now it will be at the bottom of screen
class Panel extends St.BoxLayout {
  static {
    GObject.registerClass(this); // this is required to make the c - libs know that this exists
  }

  private _settings: Gio.Settings; // this will be the settings obj that will be passed as a parameter to the constructor of the panel class

  constructor(settings: Gio.Settings) {
    super({
      styleClass: "app-tab-panel",
      reactive: true,
    });
    this._settings = settings;

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

    // Hide it whenever the overview opens.
    Main.overview.connectObject("showing", () => this.hide(), this);

    // Show it whenever the overview closes.
    Main.overview.connectObject("hiding", () => this.show(), this);

    Main.layoutManager.connectObject(
      "monitors-changed",
      () => this._redrawPanel(),
      this,
    );

    // Update the windows when a new window is created
    global.display.connectObject(
      "window-created",
      (_display: any, window: Meta.Window) => {
        this._updateWindows();

        window.connect("unmanaged", () => {
          this._updateWindows();
        });
      },
    );
  }

  private _syncWithOverview() {
    if (Main.overview.visible) this.hide();
    else this.show();
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

  private _updateWindows() {
    this.destroy_all_children();

    const windows = global
      .get_window_actors()
      .map((actor) => actor.meta_window);

    for (const window of windows) {
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
  }
}
