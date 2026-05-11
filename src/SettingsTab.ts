import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import FolderColorPlugin from 'main';
import { FolderColorSettings, Preset } from 'settings';

export class FolderColorSettingsTab extends PluginSettingTab {
	plugin: FolderColorPlugin;

	constructor(app: App, plugin: FolderColorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Export / Import ──────────────────────────────
		new Setting(containerEl)
			.setName('Configuration')
			.setHeading();

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

		new Setting(containerEl)
			.setName('Import configuration')
			.setDesc('Load colors and presets from a previously exported JSON file.')
			.addButton(btn => btn
				.setButtonText('Import')
				.onClick(() => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = () => {
						const file = input.files?.[0];
						if (!file) return;

						file.text().then(async (text) => {
							try {
								const parsed = JSON.parse(text) as Partial<FolderColorSettings>;
								Object.assign(this.plugin.settings, parsed);
								await this.plugin.saveSettings();
								this.plugin.applyAllStyles();
								new Notice('Configuration imported successfully');
								this.display();
							} catch {
								new Notice('Error: invalid JSON file');
							}
						}).catch(() => {
							new Notice('Error: could not read file');
						});
					};
					input.click();
				})
			);

		// ── Presets ──────────────────────────────────────
		new Setting(containerEl)
			.setName('Presets')
			.setHeading();

		if (this.plugin.settings.presets.length === 0) {
			containerEl.createEl('p', { text: 'No presets saved yet.', cls: 'presets-empty' });
		}

		this.plugin.settings.presets.forEach((preset: Preset, index: number) => {
			const setting = new Setting(containerEl)
				.setName(preset.name);

			// Visual preview of the preset's start color.
			// Inline styles are required here because the color values are user-defined
			// and cannot be expressed as static CSS classes.
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

			// Visual preview of the preset's end color
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
