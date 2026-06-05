import { Plugin, TFile, TFolder, Menu, TAbstractFile } from 'obsidian';
import { ColorSettingsModal } from 'ColorSettingsModal';
import { FolderColorSettings, ColorConfig, FileColorConfig, DEFAULT_SETTINGS } from 'settings';
import { ColorManager } from 'ColorManager';
import { StyleManager } from 'StyleManager';
import { FolderColorSettingsTab } from 'SettingsTab';

export default class FolderColorPlugin extends Plugin {
	settings: FolderColorSettings;
	colorManager: ColorManager;
	styleManager: StyleManager;

	async onload() {
		await this.loadSettings();
		this.colorManager = new ColorManager(this.app, this.settings);
		this.styleManager = new StyleManager(this.app);
		this.addSettingTab(new FolderColorSettingsTab(this.app, this));
		this.applyAllStyles();

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				menu.addItem((item) => {
					item
						.setTitle('Assign color')
						.setIcon('palette')
						.onClick(() => {
							new ColorSettingsModal(this.app, file, this.settings, (result: ColorConfig | FileColorConfig | null) => {
								if (result === null) {
									if (file instanceof TFolder) {
										delete this.settings.folders[file.path];
									} else if (file instanceof TFile) {
										delete this.settings.files[file.path];
									}
								} else {
									if (file instanceof TFolder) {
										this.settings.folders[file.path] = result as ColorConfig;
									} else if (file instanceof TFile) {
										this.settings.files[file.path] = result as FileColorConfig;
									}
								}
								// Save and re-apply styles after the modal closes
								void this.saveSettings().then(() => this.applyAllStyles());
							}).open();
						});
				});
			})
		);

		this.registerEvent(
			this.app.vault.on('create', () => {
				this.applyAllStyles();
			})
		);

		// Clean up deleted folders/files and refresh styles
		this.registerEvent(
			this.app.vault.on('delete', (file: TAbstractFile) => {
				if (file instanceof TFolder) {
					delete this.settings.folders[file.path];
				} else if (file instanceof TFile) {
					delete this.settings.files[file.path];
				}
				void this.saveSettings().then(() => this.applyAllStyles());
			})
		);

		// Refresh styles after rename/move (paths change)
		this.registerEvent(
			this.app.vault.on('rename', () => {
				this.applyAllStyles();
			})
		);
	}

	onunload() {
		this.styleManager.removeStyles();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FolderColorSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	applyAllStyles() {
		this.styleManager.applyStyles(this.colorManager.generateStyles());
	}
}
