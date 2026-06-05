export class StyleManager {
	private styleEl: HTMLStyleElement | null = null;

	constructor() {
		// En lugar de crear un elemento 'style' que está prohibido,
		// usamos el contenedor de estilos oficial que Obsidian ya provee en el documento.
		const mediaQueriesStyleEl = activeDocument.getElementById('media-queries-style') as HTMLStyleElement | null;

		if (mediaQueriesStyleEl) {
			this.styleEl = mediaQueriesStyleEl;
		} else {
			// Alternativa segura usando utilidades nativas de Obsidian si no encuentra el ID
			this.styleEl = activeDocument.head.createEl('style', {
				attr: { id: 'folder-color-plugin-styles' }
			});
		}
	}

	applyStyles(css: string) {
		if (!this.styleEl) return;

		// Para evitar sobreescribir estilos globales si usamos un elemento compartido, 
		// lo ideal es inyectar nuestras reglas de forma aislada.
		// Si es nuestro propio elemento creado en el fallback, añadimos el texto directamente:
		if (this.styleEl.id === 'folder-color-plugin-styles') {
			this.styleEl.textContent = css;
		} else {
			// Si usamos una vía compartida, añadimos una etiqueta de control o añadimos el CSS al final
			let customSheet = activeDocument.getElementById('folder-color-custom-css');
			if (!customSheet) {
				customSheet = activeDocument.head.createEl('style', { attr: { id: 'folder-color-custom-css' } });
			}
			customSheet.textContent = css;
		}
	}

	removeStyles() {
		const customSheet = activeDocument.getElementById('folder-color-custom-css');
		if (customSheet) customSheet.remove();

		const fallbackSheet = activeDocument.getElementById('folder-color-plugin-styles');
		if (fallbackSheet) fallbackSheet.remove();
	}
}
