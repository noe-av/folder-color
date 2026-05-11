import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import FolderColorPlugin from 'main';
import { Preset } from 'settings';

/**
 * Settings tab shown in Obsidian's plugin settings panel.
 *
 * Provides two sections:
 * - **Configuration**: export and import the full plugin settings as a JSON file.
 * - **Presets**: list all saved color presets with a color preview and a delete action.
 *
 * Note: presets are created from within {@link ColorSettingsModal}, not from this tab.
 * This tab only allows reviewing and deleting them.
 */
export class FolderColorSettingsTab extends PluginSettingTab {
	plugin: FolderColorPlugin;

	/**
	 * @param app - The Obsidian app instance.
	 * @param plugin - The plugin instance, used to access settings and trigger style updates.
	 */
	constructor(app: App, plugin: FolderColorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders the settings tab content.
	 * Called by Obsidian whenever the tab is opened or needs to be refreshed.
	 * Clears and rebuilds the entire panel on each call.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Folder Color Plugin' });

		// ── Exportar / Importar ──────────────────────────
		containerEl.createEl('h3', { text: 'Configuration' });

		/**
		 * Export button: serializes the full settings object (folders, files, presets)
		 * to a JSON blob and triggers a browser download.
		 */
		new Setting(containerEl)
			.setName('Export configuration')
			.setDesc('Save all colors, presets and settings to a JSON file.')
			.addButton(btn => btn
				.setButtonText('Export')
				.onClick(() => {
					const data = JSON.stringify(this.plugin.settings, null, 2);
					const blob = new Blob([data], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'folder-color-config.json';
					a.click();
					URL.revokeObjectURL(url);
					new Notice('Configuration exported');
				})
			);

		/**
		 * Import button: opens a file picker, reads the selected JSON,
		 * merges it into the current settings, and refreshes styles and the tab UI.
		 */
		new Setting(containerEl)
			.setName('Import configuration')
			.setDesc('Load colors and presets from a previously exported JSON file.')
			.addButton(btn => btn
				.setButtonText('Import')
				.onClick(() => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;
						const text = await file.text();
						try {
							const parsed = JSON.parse(text);
							Object.assign(this.plugin.settings, parsed);
							await this.plugin.saveSettings();
							this.plugin.styleManager.applyStyles(
								this.plugin.colorManager.generateStyles()
							);
							new Notice('Configuration imported successfully');
							this.display();
						} catch {
							new Notice('Error: invalid JSON file');
						}
					};
					input.click();
				})
			);

		// ── Presets ──────────────────────────────────────
		containerEl.createEl('h3', { text: 'Presets' });

		if (this.plugin.settings.presets.length === 0) {
			containerEl.createEl('p', { text: 'No presets saved yet.' })
				.style.cssText = 'color:#888;font-size:13px;';
		}

		/**
		 * Renders one row per preset with:
		 * - Two color swatches previewing the gradient start and end colors.
		 * - A delete button that removes the preset and refreshes the tab.
		 */
		this.plugin.settings.presets.forEach((preset: Preset, index: number) => {
			const setting = new Setting(containerEl)
				.setName(preset.name);

			// Gradient start color preview swatch
			const preview = setting.nameEl.createDiv();
			preview.style.cssText = `
				display: inline-flex;
				align-items: center;
				gap: 6px;
				margin-left: 10px;
				padding: 3px 10px;
				border-radius: 4px;
				background: ${preset.config.bgColorStart};
				color: ${preset.config.textColorStart};
				font-weight: ${preset.config.bold ? 'bold' : 'normal'};
				font-style: ${preset.config.italic ? 'italic' : 'normal'};
				font-size: 12px;
			`;
			preview.createSpan({ text: 'Aa' });

			// Gradient end color preview swatch
			const previewEnd = setting.nameEl.createDiv();
			previewEnd.style.cssText = `
				display: inline-flex;
				align-items: center;
				gap: 6px;
				margin-left: 4px;
				padding: 3px 10px;
				border-radius: 4px;
				background: ${preset.config.bgColorEnd};
				color: ${preset.config.textColorEnd};
				font-weight: ${preset.config.bold ? 'bold' : 'normal'};
				font-style: ${preset.config.italic ? 'italic' : 'normal'};
				font-size: 12px;
			`;
			previewEnd.createSpan({ text: 'Aa' });

			setting.addButton(btn => btn
				.setButtonText('Delete')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.presets.splice(index, 1);
					await this.plugin.saveSettings();
					new Notice(`Preset "${preset.name}" deleted`);
					this.display();
				})
			);
		});
	}
}
