import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import St from "gi://St";

export default class AppTab extends Extension {
  gsettings?: Gio.Settings;
  private _panel?: St.BoxLayout;

  enable(): void {
    // initialize settings first
    this.gsettings = this.getSettings();

    this._panel = new St.BoxLayout({
      vertical: false,
      style: `background-color: #000000`,
    });

    this._panel.set_height(40);
    this._panel.set_width(
      global.display.get_monitor_geometry(global.display.get_current_monitor())
        .width,
    );

    this._panel.set_position(
      0,
      global
        .get_display()
        .get_monitor_geometry(global.display.get_current_monitor()).height - 40,
    );

    const currentFocusedWindow = global.display.get_focus_window();

    const label = new St.Label({
      text: currentFocusedWindow
        ? currentFocusedWindow.get_title()
        : "No window focused",
    });

    const m = Main.layoutManager.primaryMonitor;
    this._panel.add_child(label);
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
