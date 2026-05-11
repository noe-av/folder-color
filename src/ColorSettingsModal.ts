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
	private onSubmit: (result: ColorConfig | FileColorConfig | null) => void;
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
		onSubmit: (result: ColorConfig | FileColorConfig | null) => void
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
			} satisfies ColorConfig;

			// Migrate older configs that predate the applyToSubfolders/applyToFiles fields
			const folderConfig = this.config;
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
			} satisfies FileColorConfig;
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
		this.renderCheckbox(container, 'Apply to subfolders', config.applyToSubfolders ?? true, (val) => {
			(this.config as ColorConfig).applyToSubfolders = val;
		});
		this.renderCheckbox(container, 'Apply to files', config.applyToFiles ?? true, (val) => {
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
	 * Static layout is handled by the `.color-row` CSS class in styles.css.
	 *
	 * @param container - The element to render into.
	 * @param label - Display label shown to the left of the picker.
	 * @param value - Initial hex color value.
	 * @param onChange - Callback invoked with the new hex value on every input change.
	 */
	renderColorRow(container: HTMLElement, label: string, value: string, onChange: (val: string) => void) {
		const row = container.createDiv({ cls: 'color-row' });
		row.createEl('label', { text: label });

		const input = row.createEl('input', { type: 'color' });
		input.value = value;

		const hex = row.createEl('span', { text: value, cls: 'color-hex' });

		// Update both the config and the hex label on every change
		input.oninput = () => {
			onChange(input.value);
			hex.textContent = input.value;
		};
	}

	/**
	 * Renders a labeled checkbox row.
	 * Static layout is handled by the `.checkbox-row` CSS class in styles.css.
	 *
	 * @param container - The element to render into.
	 * @param label - Display label shown to the right of the checkbox.
	 * @param value - Initial checked state.
	 * @param onChange - Callback invoked with the new boolean value on change.
	 */
	renderCheckbox(container: HTMLElement, label: string, value: boolean, onChange: (val: boolean) => void) {
		const row = container.createDiv({ cls: 'checkbox-row' });

		const input = row.createEl('input', { type: 'checkbox' });
		input.checked = value;
		input.onchange = () => onChange(input.checked);

		row.createEl('label', { text: label });
	}

	/**
	 * Renders the presets section (folder targets only).
	 *
	 * Displays all saved presets as clickable buttons that overwrite the current config,
	 * each with a delete button. Also provides an input to save the current config
	 * as a new named preset.
	 *
	 * The color previews use inline styles because their values come from user-defined
	 * color data and cannot be expressed as static CSS classes.
	 *
	 * @param container - The element to render into.
	 */
	renderPresets(container: HTMLElement) {
		if (!this.isFolder) return;

		const section = container.createDiv({ cls: 'presets-section' });
		section.createEl('h3', { text: 'Presets' });

		if (this.settings.presets.length > 0) {
			const list = section.createDiv({ cls: 'presets-list' });

			this.settings.presets.forEach((preset: Preset, index: number) => {
				// Apply button — overwrites the current config and re-renders the modal
				const btn = list.createEl('button', { text: preset.name, cls: 'preset-btn' });
				btn.onclick = () => {
					this.config = { ...preset.config };
					this.onOpen();
				};

				// Delete button — removes the preset from settings and re-renders
				const del = list.createEl('button', { text: '×', cls: 'preset-delete-btn' });
				del.onclick = () => {
					this.settings.presets.splice(index, 1);
					this.onOpen();
				};
			});
		} else {
			section.createEl('p', { text: 'No presets saved yet.', cls: 'presets-empty' });
		}

		// Save current config as a new preset
		const saveRow = section.createDiv({ cls: 'preset-save-row' });

		const nameInput = saveRow.createEl('input', { type: 'text', placeholder: 'Preset name', cls: 'preset-name-input' });

		const saveBtn = saveRow.createEl('button', { text: 'Save preset', cls: 'preset-save-btn' });
		saveBtn.onclick = () => {
			if (!nameInput.value.trim()) {
				new Notice('Please enter a preset name');
				return;
			}
			this.settings.presets.push({
				name: nameInput.value.trim(),
				config: { ...(this.config as ColorConfig) }
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
		const section = container.createDiv({ cls: 'actions-section' });

		const removeBtn = section.createEl('button', { text: 'Remove color', cls: 'remove-btn' });
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

		const applyBtn = section.createEl('button', { text: 'Apply', cls: 'apply-btn' });
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
