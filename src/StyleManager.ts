export class StyleManager {
	private styleEl: HTMLStyleElement | null = null;

	constructor() {
		// Tipamos usando la interfaz nativa de Obsidian extendida sobre el objeto Window
		const currentWindow = window as Window & { activeDocument?: Document };
		const activeDoc = currentWindow.activeDocument || document;

		// eslint-disable-next-line obsidianmd/no-forbidden-elements -- Injected style elements are required for dynamic runtime user-defined colors.
		this.styleEl = activeDoc.head.createEl('style', {
			attr: { id: 'folder-color-plugin-styles' }
		});
	}

	/**
	 * Aplica el CSS generado dinámicamente.
	 */
	applyStyles(css: string) {
		if (this.styleEl) {
			this.styleEl.textContent = css;
		}
	}

	/**
	 * Remueve el elemento del DOM al desactivar el plugin.
	 */
	removeStyles() {
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
	}
}
