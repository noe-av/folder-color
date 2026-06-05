import { App } from 'obsidian';

export class StyleManager {
	private app: App;
	private styleEl: HTMLStyleElement | null = null;

	constructor(app: App) {
		this.app = app;

		// 1. Obtenemos de forma segura el documento activo desde el contenedor del espacio de trabajo
		// Esto soluciona la advertencia naranja de compatibilidad con ventanas flotantes (popout windows)
		const activeDoc = this.app.workspace.containerEl.doc;

		// 2. Buscamos si ya existe el elemento, si no, lo creamos de forma permitida por Obsidian
		let el = activeDoc.getElementById('folder-color-plugin-styles') as HTMLStyleElement | null;
		if (!el) {
			el = activeDoc.createElement('style');
			el.id = 'folder-color-plugin-styles';
			activeDoc.head.appendChild(el);
		}
		this.styleEl = el;
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
