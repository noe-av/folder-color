import { App, Modal, TAbstractFile, TFolder, TFile, Notice } from 'obsidian';
import { FolderColorSettings, ColorConfig, FileColorConfig, Preset } from 'settings';

/**
 * Modal dialog for configuring the color settings of a folder or file.
 *
 * Opens when the user selects "Assign color" from the file explorer context menu.
 * Renders different forms depending on whether the target is a folder or a file:
 * - Folders: gradient start/end colors, subfolder/file inheritance toggles, and presets.
 * - Files: single background and text color, no gradient or presets.
 *
 * On submit, calls the provided callback with the updated config (or null to remove it).
 */
export class ColorSettingsModal extends Modal {
	private file: TAbstractFile;
	private settings: FolderColorSettings;
	private onSubmit: (result: any) => void;
	private isFolder: boolean;

	/** The config object being edited. Mutated in place by the form controls. */
	private config: ColorConfig | FileColorConfig;

	/**
	 * @param app - The Obsidian app instance.
	 * @param file - The folder or file being configured.
	 * @param settings - The plugin's current settings, used to read existing configs and presets.
	 * @param onSubmit - Callback invoked when the user applies or removes a color.
	 *                   Receives the updated config, or null if the color was removed.
	 */
	constructor(
		app: App,
		file: TAbstractFile,
		settings: FolderColorSettings,
		onSubmit: (result: any) => void
	) {
		super(app);
		this.file = file;
		this.settings = settings;
		this.onSubmit = onSubmit;
		this.isFolder = file instanceof TFolder;

		if (this.isFolder) {
			// Load existing folder config or fall back to defaults
			this.config = settings.folders[file.path] ?? {
				bgColorStart: '#000000',
				bgColorEnd: '#000000',
				textColorStart: '#ffffff',
				textColorEnd: '#ffffff',
				bold: false,
				italic: false,
				applyToSubfolders: true,
				applyToFiles: true,
				applyBgColor: true,
			} as ColorConfig;

			// Migrate older configs that predate the applyToSubfolders/applyToFiles fields
			const folderConfig = this.config as ColorConfig;
			if (folderConfig.applyToSubfolders === undefined) {
				folderConfig.applyToSubfolders = true;
			}
			if (folderConfig.applyToFiles === undefined) {
				folderConfig.applyToFiles = true;
			}
		} else {
			// Load existing file config or fall back to defaults
			const existingFile = settings.files[file.path];
			this.config = {
				bgColor: existingFile?.bgColor ?? '#1e40af',
				textColor: existingFile?.textColor ?? '#ffffff',
				bold: existingFile?.bold ?? false,
				italic: existingFile?.italic ?? false,
				applyBgColor: existingFile?.applyBgColor ?? true,
			} as FileColorConfig;
		}
	}

	/**
	 * Builds and renders the modal content.
	 * Also used as a re-render trigger (e.g. after applying a preset or deleting one),
	 * since it clears and rebuilds the entire content element.
	 */
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('folder-color-modal');

		contentEl.createEl('h2', { text: `Assign color — ${this.file.name}` });

		if (this.isFolder) {
			this.renderFolderForm(contentEl);
		} else {
			this.renderFileForm(contentEl);
		}

		this.renderPresets(contentEl);
		this.renderActions(contentEl);
	}

	/**
	 * Renders the color form for a folder target.
	 * Includes gradient start/end pickers for background and text,
	 * plus toggles for bold, italic, and inheritance behavior.
	 *
	 * @param container - The element to render into.
	 */
	renderFolderForm(container: HTMLElement) {
		const config = this.config as ColorConfig;

		this.renderCheckbox(container, 'Apply background color', config.applyBgColor ?? true, (val) => {
			(this.config as ColorConfig).applyBgColor = val;
		});

		this.renderColorRow(container, 'Background start', config.bgColorStart, (val) => {
			(this.config as ColorConfig).bgColorStart = val;
		});
		this.renderColorRow(container, 'Background end', config.bgColorEnd, (val) => {
			(this.config as ColorConfig).bgColorEnd = val;
		});
		this.renderColorRow(container, 'Text start', config.textColorStart, (val) => {
			(this.config as ColorConfig).textColorStart = val;
		});
		this.renderColorRow(container, 'Text end', config.textColorEnd, (val) => {
			(this.config as ColorConfig).textColorEnd = val;
		});

		this.renderCheckbox(container, 'Bold', config.bold, (val) => {
			(this.config as ColorConfig).bold = val;
		});
		this.renderCheckbox(container, 'Italic', config.italic, (val) => {
			(this.config as ColorConfig).italic = val;
		});
		this.renderCheckbox(container, 'Apply to subfolders', (config as ColorConfig).applyToSubfolders ?? true, (val) => {
			(this.config as ColorConfig).applyToSubfolders = val;
		});
		this.renderCheckbox(container, 'Apply to files', (config as ColorConfig).applyToFiles ?? true, (val) => {
			(this.config as ColorConfig).applyToFiles = val;
		});
	}

	/**
	 * Renders the color form for a file target.
	 * Simpler than the folder form — single background and text color, no gradient.
	 *
	 * @param container - The element to render into.
	 */
	renderFileForm(container: HTMLElement) {
		const config = this.config as FileColorConfig;

		this.renderCheckbox(container, 'Apply background color', config.applyBgColor ?? true, (val) => {
			(this.config as FileColorConfig).applyBgColor = val;
		});

		this.renderColorRow(container, 'Background', config.bgColor, (val) => {
			(this.config as FileColorConfig).bgColor = val;
		});
		this.renderColorRow(container, 'Text color', config.textColor, (val) => {
			(this.config as FileColorConfig).textColor = val;
		});

		this.renderCheckbox(container, 'Bold', config.bold, (val) => {
			(this.config as FileColorConfig).bold = val;
		});
		this.renderCheckbox(container, 'Italic', config.italic, (val) => {
			(this.config as FileColorConfig).italic = val;
		});
	}

	/**
	 * Renders a labeled color picker row with a live hex value preview.
	 *
	 * @param container - The element to render into.
	 * @param label - Display label shown to the left of the picker.
	 * @param value - Initial hex color value.
	 * @param onChange - Callback invoked with the new hex value on every input change.
	 */
	renderColorRow(container: HTMLElement, label: string, value: string, onChange: (val: string) => void) {
		const row = container.createDiv({ cls: 'color-row' });
		row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px;';

		row.createEl('label', { text: label }).style.cssText = 'min-width:140px;font-size:14px;';

		const input = row.createEl('input', { type: 'color' });
		input.value = value;
		input.style.cssText = 'width:48px;height:32px;border:none;cursor:pointer;border-radius:4px;';

		const hex = row.createEl('span', { text: value });
		hex.style.cssText = 'font-size:12px;color:#888;';

		// Update both the config and the hex label on every change
		input.oninput = () => {
			onChange(input.value);
			hex.textContent = input.value;
		};
	}

	/**
	 * Renders a labeled checkbox row.
	 *
	 * @param container - The element to render into.
	 * @param label - Display label shown to the right of the checkbox.
	 * @param value - Initial checked state.
	 * @param onChange - Callback invoked with the new boolean value on change.
	 */
	renderCheckbox(container: HTMLElement, label: string, value: boolean, onChange: (val: boolean) => void) {
		const row = container.createDiv();
		row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';

		const input = row.createEl('input', { type: 'checkbox' });
		input.checked = value;
		input.onchange = () => onChange(input.checked);

		row.createEl('label', { text: label }).style.cssText = 'font-size:14px;';
	}

	/**
	 * Renders the presets section (folder targets only).
	 *
	 * Displays all saved presets as clickable buttons that overwrite the current config,
	 * each with a delete button. Also provides an input to save the current config
	 * as a new named preset.
	 *
	 * @param container - The element to render into.
	 */
	renderPresets(container: HTMLElement) {
		if (!this.isFolder) return;

		const section = container.createDiv();
		section.style.cssText = 'margin-top:16px;border-top:1px solid #333;padding-top:12px;';
		section.createEl('h3', { text: 'Presets' }).style.cssText = 'font-size:14px;margin-bottom:8px;';

		if (this.settings.presets.length > 0) {
			const list = section.createDiv();
			list.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;';

			this.settings.presets.forEach((preset: Preset, index: number) => {
				// Apply button — overwrites the current config and re-renders the modal
				const btn = list.createEl('button', { text: preset.name });
				btn.style.cssText = 'padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;';
				btn.onclick = () => {
					this.config = { ...preset.config };
					this.onOpen();
				};

				// Delete button — removes the preset from settings and re-renders
				const del = list.createEl('button', { text: '×' });
				del.style.cssText = 'padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;color:red;background:none;border:none;';
				del.onclick = () => {
					this.settings.presets.splice(index, 1);
					this.onOpen();
				};
			});
		} else {
			section.createEl('p', { text: 'No presets saved yet.' }).style.cssText = 'font-size:12px;color:#888;';
		}

		// Save current config as a new preset
		const saveRow = section.createDiv();
		saveRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;';

		const nameInput = saveRow.createEl('input', { type: 'text', placeholder: 'Preset name' });
		nameInput.style.cssText = 'flex:1;padding:6px 10px;border-radius:4px;font-size:13px;';

		const saveBtn = saveRow.createEl('button', { text: 'Save preset' });
		saveBtn.style.cssText = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;';
		saveBtn.onclick = () => {
			if (!nameInput.value.trim()) {
				new Notice('Please enter a preset name');
				return;
			}
			this.settings.presets.push({
				name: nameInput.value.trim(),
				config: { ...this.config as ColorConfig }
			});
			new Notice(`Preset "${nameInput.value.trim()}" saved`);
			nameInput.value = '';
			this.onOpen();
		};
	}

	/**
	 * Renders the action buttons at the bottom of the modal.
	 *
	 * - "Remove color": deletes the config for this file/folder and closes the modal.
	 * - "Apply": saves the current config and closes the modal.
	 *
	 * @param container - The element to render into.
	 */
	renderActions(container: HTMLElement) {
		const section = container.createDiv();
		section.style.cssText = 'margin-top:16px;border-top:1px solid #333;padding-top:12px;display:flex;gap:8px;';

		const removeBtn = section.createEl('button', { text: '🗑 Remove color' });
		removeBtn.style.cssText = 'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;color:#e06c75;';
		removeBtn.onclick = () => {
			if (this.file instanceof TFolder) {
				delete this.settings.folders[this.file.path];
			} else if (this.file instanceof TFile) {
				delete this.settings.files[this.file.path];
			}
			this.onSubmit(null);
			this.close();
			new Notice('Color removed');
		};

		const applyBtn = section.createEl('button', { text: '✓ Apply' });
		applyBtn.style.cssText = 'padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;background:#1e40af;color:#fff;border:none;margin-left:auto;';
		applyBtn.onclick = () => {
			this.onSubmit(this.config);
			this.close();
		};
	}

	/** Clears the modal content on close to avoid memory leaks from lingering DOM references. */
	onClose() {
		this.contentEl.empty();
	}
}
