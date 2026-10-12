import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  _settings?: Gio.Settings;

  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    this._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _("General"),
      iconName: "dialog-information-symbolic",
    });

    // This group will have the settings to configure ui of the panel
    const generalGroup = new Adw.PreferencesGroup({
      title: _("General"),
      description: _("General settings for the extension"),
    });
    page.add(generalGroup);

    // This group will have settings relevent to the control of behavior of the extension
    const behaviorGroup = new Adw.PreferencesGroup({
      title: _("Behavior"),
      description: _("Behavior settings for the extension"),
    });
    page.add(behaviorGroup);

    // This controsl the height of panel
    const panelHeight = new Adw.SpinRow({
      title: _("Panel Height"),
      subtitle: _("Height of the panel"),
      adjustment: new Gtk.Adjustment({
        lower: 24,
        upper: 100,
        stepIncrement: 1,
      }),
    });

    // This settings controls if all the windows from all workspaces should be shown in the panel or not
    const showAllWindows = new Adw.SwitchRow({
      title: _("Show All Windows"),
      subtitle: _("Show windows from all the workspaces"),
    });

    // This settins is keyboard shortcut to focus the next window in the panel
    const focusNextWindow = new Adw.EntryRow({
      title: _("Focus Next Windows"),
    });

    // This settings is keyboard
    const focusPreviousWindow = new Adw.EntryRow({
      title: _("Focus Previous Windows"),
    });

    // Add the settings and groups to the window
    generalGroup.add(panelHeight);
    generalGroup.add(showAllWindows);

    behaviorGroup.add(focusNextWindow);
    behaviorGroup.add(focusPreviousWindow);

    page.add(generalGroup);
    page.add(behaviorGroup);
    window.add(page);

    // Bind the settings to ui
    this._settings!.bind(
      "panel-height",
      panelHeight,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    this._settings!.bind(
      "show-all-windows",
      showAllWindows,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    focusNextWindow.text =
      this._settings!.get_strv("focus-next-window")[0] ?? "";
    focusPreviousWindow.text =
      this._settings!.get_strv("focus-previous-window")[0] ?? "";

    focusNextWindow.connect("changed", () => {
      this._settings!.set_strv("focus-next-window", [focusNextWindow.text]);
    });

    focusPreviousWindow.connect("changed", () => {
      this._settings!.set_strv("focus-previous-window", [
        focusPreviousWindow.text,
      ]);
    });

    return Promise.resolve();
  }
}
