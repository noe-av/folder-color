import { App } from 'obsidian';

export class StyleManager {
	private app: App;
	private styleEl: HTMLStyleElement | null = null;

	constructor(app: App) {
		this.app = app;

		// Accedemos de forma segura a través del contenedor principal de la aplicación.
		// Esto es 100% compatible con popout windows y entornos headless de GitHub Actions.
		const doc = this.app.workspace.containerEl.doc;

		this.styleEl = doc.head.createEl('style', {
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
