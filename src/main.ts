import { Plugin, TFile, TFolder, Menu, TAbstractFile } from 'obsidian';
import { ColorSettingsModal } from 'ColorSettingsModal';
import { FolderColorSettings, DEFAULT_SETTINGS } from 'settings';
import { ColorManager } from 'ColorManager';
import { StyleManager } from 'StyleManager';
import { FolderColorSettingsTab } from 'SettingsTab';

/**
 * Entry point for the Folder Color plugin.
 *
 * Orchestrates the three main subsystems:
 * - {@link ColorManager} — computes gradient colors and generates CSS.
 * - {@link StyleManager} — injects and updates the CSS in the DOM.
 * - {@link ColorSettingsModal} — UI for assigning colors to folders/files.
 *
 * Lifecycle:
 * - On load: registers vault events, adds the context menu item, and applies
 *   any previously saved styles.
 * - On unload: removes the injected style element to leave no side effects.
 */
export default class FolderColorPlugin extends Plugin {
	settings: FolderColorSettings;
	colorManager: ColorManager;
	styleManager: StyleManager;

	/**
	 * Called by Obsidian when the plugin is enabled.
	 *
	 * Initializes subsystems, registers vault and workspace event listeners,
	 * adds the settings tab, and performs an initial style application.
	 */
	async onload() {
		await this.loadSettings();
		this.colorManager = new ColorManager(this.settings);
		this.styleManager = new StyleManager();
		this.addSettingTab(new FolderColorSettingsTab(this.app, this));
		this.applyAllStyles();

		// Add "Assign color" to the file explorer context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				menu.addItem((item) => {
					item
						.setTitle('Assign color')
						.setIcon('palette')
						.onClick(() => {
							new ColorSettingsModal(this.app, file, this.settings, async (result) => {
								if (result === null) {
									// Remover color
									if (file instanceof TFolder) {
										delete this.settings.folders[file.path];
									} else if (file instanceof TFile) {
										delete this.settings.files[file.path];
									}
								} else {
									if (file instanceof TFolder) {
										this.settings.folders[file.path] = result;
									} else if (file instanceof TFile) {
										this.settings.files[file.path] = result;
									}
								}
								await this.saveSettings();
								this.applyAllStyles();
							}).open();
						});
				});
			})
		);

		// Re-apply styles when a new file or folder is created,
		// so inherited gradient colors update immediately.
		this.registerEvent(
			this.app.vault.on('create', (_file: TAbstractFile) => {
				this.applyAllStyles();
			})
		);

		// Detectar carpetas eliminadas
		// Clean up stored config for deleted items and refresh styles.
		this.registerEvent(
			this.app.vault.on('delete', (file: TAbstractFile) => {
				if (file instanceof TFolder) {
					delete this.settings.folders[file.path];
				} else if (file instanceof TFile) {
					delete this.settings.files[file.path];
				}
				this.saveSettings();
				this.applyAllStyles();
			})
		);

		// Detectar carpetas renombradas o movidas
		// Re-apply styles on rename/move; path keys in settings may now be stale,
		// but CSS selectors use data-path attributes which Obsidian updates live.
		this.registerEvent(
			this.app.vault.on('rename', (_file) => {
				this.applyAllStyles();
			})
		);
	}

	/**
	 * Called by Obsidian when the plugin is disabled or unloaded.
	 * Removes the injected `<style>` element to avoid leaving orphan styles.
	 */
	onunload() {
		this.styleManager.removeStyles();
	}

	/**
	 * Loads persisted settings from Obsidian's data store,
	 * merging them with {@link DEFAULT_SETTINGS} to fill any missing fields.
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FolderColorSettings>);
	}

	/**
	 * Persists the current settings to Obsidian's data store.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Regenerates the full CSS from the current settings and injects it into the DOM.
	 * Should be called after any change to folder/file color configs.
	 */
	applyAllStyles() {
		this.styleManager.applyStyles(this.colorManager.generateStyles());
	}
}
