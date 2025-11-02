import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { PROJECT } from './src/constants';

const iconPath = resolve(__dirname, 'src/logo.png');
const iconBuffer = readFileSync(iconPath);
const iconBase64 = `data:image/png;base64,${iconBuffer.toString('base64')}`;

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		monkey({
			entry: 'src/main.ts',
			userscript: {
				name: `${PROJECT.NAME} ${PROJECT.TAGLINE}`,
				icon: iconBase64,
				namespace: 'https://github.com/twocaretcat',
				match: ['https://www.strava.com/athlete/segments/starred*'],
				grant: 'none',
			},
			build: {
				autoGrant: false,
			},
		}),
	],
});
