const fs = require('node:fs');
const path = require('node:path');

function loadRealEnv(rootDir = path.resolve(__dirname, '..', '..')) {
	const envPath = path.join(rootDir, '.env');
	if (!fs.existsSync(envPath)) {
		return {
			ok: false,
			envPath
		};
	}

	const envText = fs.readFileSync(envPath, 'utf8');
	for (const line of envText.split(/\r?\n/)) {
		if (!line || !line.includes('=')) continue;
		const idx = line.indexOf('=');
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (!key) continue;
		process.env[key] = value;
	}

	if (!process.env.TENCENTCLOUD_SECRET_ID && process.env.TENCENTCLOUD_SECRETID) {
		process.env.TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRETID;
	}
	if (!process.env.TENCENTCLOUD_SECRET_KEY && process.env.TENCENTCLOUD_SECRETKEY) {
		process.env.TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRETKEY;
	}

	return {
		ok: true,
		envPath
	};
}

module.exports = {
	loadRealEnv
};
