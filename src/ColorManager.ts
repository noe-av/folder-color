import { App} from 'obsidian';
import { FolderColorSettings, ColorConfig } from 'settings';

/**
 * Handles all color computation and CSS generation for the plugin.
 *
 * Responsible for:
 * - Converting between color formats (hex ↔ RGB)
 * - Interpolating gradient colors based on subfolder depth
 * - Resolving inherited colors for unconfigured folders and files
 * - Generating the full CSS string that StyleManager injects into the DOM
 */
export class ColorManager {
	constructor(
		private app: App,
		private settings: FolderColorSettings
	) {}

	/**
	 * Parses a hex color string into its RGB components.
	 *
	 * @param hex - Hex color string, with or without leading '#' (e.g. '#ff0000' or 'ff0000').
	 * @returns An object with r, g, b numeric values (0–255), or null if the input is invalid.
	 */
	hexToRgb(hex: string) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1] ?? '0', 16),
			g: parseInt(result[2] ?? '0', 16),
			b: parseInt(result[3] ?? '0', 16)
		} : null;
	}

	/**
	 * Converts RGB components into a hex color string.
	 *
	 * @param r - Red channel (0–255).
	 * @param g - Green channel (0–255).
	 * @param b - Blue channel (0–255).
	 * @returns Hex color string in the format '#rrggbb'.
	 */
	rgbToHex(r: number, g: number, b: number): string {
		return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Linearly interpolates between two hex colors.
	 *
	 * Used to compute the gradient color at a given depth level,
	 * where t=0 returns colorA and t=1 returns colorB.
	 *
	 * @param colorA - Start hex color.
	 * @param colorB - End hex color.
	 * @param t - Interpolation factor between 0 and 1.
	 * @returns Interpolated hex color. Falls back to colorA if either input is invalid.
	 */
	interpolateColor(colorA: string, colorB: string, t: number): string {
		const a = this.hexToRgb(colorA);
		const b = this.hexToRgb(colorB);
		if (!a || !b) return colorA;
		const r = Math.round(a.r + (b.r - a.r) * t);
		const g = Math.round(a.g + (b.g - a.g) * t);
		const bl = Math.round(a.b + (b.b - a.b) * t);
		return this.rgbToHex(r, g, bl);
	}

	/**
	 * Walks up the path hierarchy to find the nearest ancestor folder
	 * that has an explicit color configuration.
	 *
	 * This is used to resolve inherited colors for folders and files
	 * that have no configuration of their own.
	 *
	 * @param path - Vault path of the folder or file to start from.
	 * @returns The nearest configured ancestor and its config, or null if none exists.
	 */
	findParentConfig(path: string): { path: string, config: ColorConfig } | null {
		const parts = path.split('/');
		for (let i = parts.length - 1; i >= 1; i--) {
			const parentPath = parts.slice(0, i).join('/');
			if (this.settings.folders[parentPath]) {
				return { path: parentPath, config: this.settings.folders[parentPath] };
			}
		}
		return null;
	}

	/**
	 * Computes the interpolated background and text colors for a given path,
	 * relative to its configured ancestor folder.
	 *
	 * The gradient factor (t) is determined by:
	 * - The relative depth of the path below the configured ancestor (numerator)
	 * - The maximum depth of any eligible descendant of that ancestor (denominator)
	 *
	 * Folders are excluded from the depth calculation if they have their own
	 * color config or if any of their ancestors (between them and the configured
	 * parent) already have a config — this keeps each gradient self-contained.
	 *
	 * @param path - Vault path of the folder or file to colorize.
	 * @param parentPath - Vault path of the configured ancestor folder.
	 * @param config - Color configuration of the ancestor folder.
	 * @returns Object with interpolated `bg` and `text` hex color strings.
	 */
	getColorForPath(path: string, parentPath: string, config: ColorConfig): { bg: string, text: string } {
		const allFolders = this.app.vault.getAllFolders();

		// Relative depth of this path below the configured ancestor
		const level = path.split('/').length - parentPath.split('/').length;

		// Find the maximum depth among eligible descendants of the configured ancestor.
		// A descendant is ineligible if it has its own config or if any intermediate
		// ancestor (between parentPath and itself) has a config.
		let maxLevel = 1;
		for (const f of allFolders) {
			if (!f.path.startsWith(parentPath + '/')) continue;
			if (this.settings.folders[f.path]) continue;

			const parts = f.path.split('/');
			const parentDepth = parentPath.split('/').length;
			let hasConfigAncestor = false;
			for (let i = parentDepth + 1; i < parts.length; i++) {
				const ancestorPath = parts.slice(0, i).join('/');
				if (this.settings.folders[ancestorPath]) {
					hasConfigAncestor = true;
					break;
				}
			}
			if (hasConfigAncestor) continue;

			const depth = f.path.split('/').length - parentPath.split('/').length;
			if (depth > maxLevel) maxLevel = depth;
		}

		// Clamp t to [0, 1] to avoid going past the end color
		const t = Math.min(level / maxLevel, 1);

		return {
			bg: this.interpolateColor(config.bgColorStart, config.bgColorEnd, t),
			text: this.interpolateColor(config.textColorStart, config.textColorEnd, t)
		};
	}

	/**
	 * Generates the complete CSS string for all colored folders and files in the vault.
	 *
	 * The generation is split into three passes:
	 * 1. Folders with explicit configs — always rendered with their start colors.
	 * 2. Subfolders without configs — rendered with interpolated gradient colors
	 *    inherited from their nearest configured ancestor (if applyToSubfolders is enabled).
	 * 3. Files — rendered either from their own config or inherited from their
	 *    containing folder's gradient (if applyToFiles is enabled).
	 *
	 * @returns A CSS string ready to be injected into the DOM via StyleManager.
	 */
	generateStyles(): string {
		let css = '';

		// Pass 1: Folders with their own explicit color configuration
		for (const [path, config] of Object.entries(this.settings.folders)) {
			if (!config || !config.bgColorStart) continue;
			const escapedPath = path.replace(/"/g, '\\"');

			css += `
				.nav-folder-title[data-path="${escapedPath}"] {
					background: transparent !important;
					color: ${config.textColorStart} !important;
					font-weight: ${config.bold ? 'bold' : 'normal'} !important;
					font-style: ${config.italic ? 'italic' : 'normal'} !important;
					align-items: center !important;
				}
				.nav-folder-title[data-path="${escapedPath}"] .tree-item-icon svg {
					stroke: ${config.textColorStart} !important;
				}
				.nav-folder-title[data-path="${escapedPath}"] > .tree-item-inner {
					background: ${config.applyBgColor ? config.bgColorStart : 'transparent'} !important;
					border-radius: 4px !important;
					padding: 2px 8px !important;
					flex: 1 1 0 !important;
					min-width: 0 !important;
					align-self: stretch !important;
					margin-right: -8px !important;
				}`;
		}

		// Pass 2: Subfolders that inherit gradient colors from a configured ancestor
		const allFolders = this.app.vault.getAllFolders();
		for (const folder of allFolders) {
			const path = folder.path;
			if (this.settings.folders[path]) continue; // already handled in Pass 1

			const parent = this.findParentConfig(path);
			if (!parent || !parent.config.applyToSubfolders) continue;

			const { bg: rawBg, text } = this.getColorForPath(path, parent.path, parent.config);
			const bg = parent.config.applyBgColor ? rawBg : 'transparent';
			const escapedPath = path.replace(/"/g, '\\"');
			const bold = parent.config.bold ? 'bold' : 'normal';
			const italic = parent.config.italic ? 'italic' : 'normal';

			css += `
				.nav-folder-title[data-path="${escapedPath}"] {
					background: transparent !important;
					color: ${text} !important;
					font-weight: ${bold} !important;
					font-style: ${italic} !important;
					align-items: center !important;
				}
				.nav-folder-title[data-path="${escapedPath}"] .tree-item-icon svg {
					stroke: ${text} !important;
				}
				.nav-folder-title[data-path="${escapedPath}"] > .tree-item-inner {
					background: ${bg} !important;
					border-radius: 4px !important;
					padding: 2px 8px !important;
					flex: 1 1 0 !important;
					min-width: 0 !important;
					align-self: stretch !important;
					margin-right: -8px !important;
				}`;
		}

		// Pass 3: Files — either from their own config or inherited from their parent folder
		const allFiles = this.app.vault.getFiles();
		for (const file of allFiles) {
			const path = file.path;

			// File has its own explicit configuration
			if (this.settings.files[path]) {
				const fileConfig = this.settings.files[path];
				if (!fileConfig) continue;

				css += this.generateFileStyle(path, fileConfig.bgColor, fileConfig.textColor, fileConfig.bold, fileConfig.italic, fileConfig.applyBgColor ?? true);
				continue;
			}

			// File has no config — inherit from the nearest configured ancestor folder
			const parent = this.findParentConfig(path);
			if (!parent || !parent.config.applyToFiles) continue;

			// Use the color of the file's direct containing folder, not the root ancestor,
			// so that the file visually matches its immediate parent in the gradient.
			const folderPath = path.split('/').slice(0, -1).join('/');
			let colors: { bg: string, text: string };

			if (this.settings.folders[folderPath]) {
				// Containing folder has its own config — use its start color directly
				const folderConfig = this.settings.folders[folderPath];
				colors = { bg: folderConfig?.bgColorStart ?? '#000000', text: folderConfig?.textColorStart ?? '#ffffff' };
			} else {
				// Containing folder inherits — compute its gradient color
				colors = this.getColorForPath(folderPath, parent.path, parent.config);
			}

			css += this.generateFileStyle(path, colors.bg, colors.text, parent.config.bold, parent.config.italic, parent.config.applyBgColor ?? true);
		}

		return css;
	}

	/**
	 * Generates the CSS rules for a single file item in the navigator.
	 *
	 * Files with a non-markdown extension get a split pill style:
	 * the file name and the extension tag share the same background color
	 * but have separate border-radius to appear as a connected unit.
	 *
	 * @param path - Vault path of the file.
	 * @param bg - Background hex color.
	 * @param text - Text hex color.
	 * @param bold - Whether to render the file name in bold.
	 * @param italic - Whether to render the file name in italic.
	 * @param applyBgColor - Whether to apply the background color. Defaults to true.
	 * @returns CSS string for this file's nav item selectors.
	 */
	generateFileStyle(path: string, bg: string, text: string, bold: boolean, italic: boolean, applyBgColor: boolean = true): string {
		const escapedPath = path.replace(/"/g, '\\"');

		// Non-markdown files show a file extension tag next to the name
		const hasTag = !path.endsWith('.md') && path.includes('.');

		return `
			.nav-file-title[data-path="${escapedPath}"] {
				background: transparent !important;
				color: ${text} !important;
				font-weight: ${bold ? 'bold' : 'normal'} !important;
				font-style: ${italic ? 'italic' : 'normal'} !important;
				align-items: center !important;
			}
			.nav-file-title[data-path="${escapedPath}"] > .tree-item-inner {
				background: ${applyBgColor ? bg : 'transparent'} !important;
				border-radius: ${hasTag ? '4px 0 0 4px' : '4px'} !important;
				padding: 2px 8px !important;
				flex: 0 1 auto !important;
				min-width: 0 !important;
				align-self: stretch !important;
				margin-right: 0 !important;
			}${hasTag ? `
			.nav-file-title[data-path="${escapedPath}"] > .nav-file-tag {
				background: ${applyBgColor ? bg : 'transparent'} !important;
				color: ${text} !important;
				border-radius: 0 4px 4px 0 !important;
				align-self: stretch !important;
				display: flex !important;
				align-items: center !important;
				margin-left: 0 !important;
				margin-right: 0 !important;
				padding-right: 4px !important;
			}` : ''}`;
	}
}
