/**
 * Represents the color configuration for a folder.
 * Supports gradient coloring from a start color to an end color,
 * applied progressively to subfolders based on their depth.
 */
export interface ColorConfig {
	/** Background color at depth 0 (the configured folder itself). */
	bgColorStart: string;
	/** Background color at the deepest subfolder level. */
	bgColorEnd: string;
	/** Text color at depth 0. */
	textColorStart: string;
	/** Text color at the deepest subfolder level. */
	textColorEnd: string;
	/** Whether folder names should be rendered in bold. */
	bold: boolean;
	/** Whether folder names should be rendered in italic. */
	italic: boolean;
	/** Whether the gradient should be applied to subfolders. */
	applyToSubfolders: boolean;
	/** Whether the gradient should be applied to files inside this folder. */
	applyToFiles: boolean;
	/** Whether the background color should be rendered. If false, only text color applies. */
	applyBgColor: boolean;
}

/**
 * Represents the color configuration for an individual file.
 * Unlike folders, files use a single color (no gradient).
 */
export interface FileColorConfig {
	/** Background color for the file item. */
	bgColor: string;
	/** Text color for the file item. */
	textColor: string;
	/** Whether the file name should be rendered in bold. */
	bold: boolean;
	/** Whether the file name should be rendered in italic. */
	italic: boolean;
	/** Whether the background color should be rendered. If false, only text color applies. */
	applyBgColor: boolean;
}

/**
 * Represents a saved color preset.
 * Presets store a named ColorConfig that can be reused across folders.
 */
export interface Preset {
	/** Display name for the preset. */
	name: string;
	/** The folder color configuration stored in this preset. */
	config: ColorConfig;
}

/**
 * Root settings object for the Folder Color plugin.
 * Persisted via Obsidian's data.json.
 */
export interface FolderColorSettings {
	/** Map of vault folder paths to their color configurations. */
	folders: Record<string, ColorConfig>;
	/** Map of vault file paths to their color configurations. */
	files: Record<string, FileColorConfig>;
	/** List of saved color presets. */
	presets: Preset[];
}

/** Default settings used when the plugin is first installed or reset. */
export const DEFAULT_SETTINGS: FolderColorSettings = {
	folders: {},
	files: {},
	presets: []
};
