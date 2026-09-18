const Module = require('module');
const path = require('path');

function resolveMockMap(targetModulePath, mocks = {}) {
	const parentDir = path.dirname(targetModulePath);
	const resolved = new Map();

	for (const [request, mock] of Object.entries(mocks)) {
		try {
			const resolvedRequest = Module._resolveFilename(request, {
				id: targetModulePath,
				filename: targetModulePath,
				paths: Module._nodeModulePaths(parentDir)
			});
			resolved.set(resolvedRequest, mock);
		} catch (err) {
			resolved.set(request, mock);
		}
	}

	return resolved;
}

function loadWithMocks(modulePath, mocks = {}) {
	const resolvedTarget = require.resolve(modulePath);
	delete require.cache[resolvedTarget];

	const resolvedMocks = resolveMockMap(resolvedTarget, mocks);
	const originalLoad = Module._load;

	Module._load = function patchedLoad(request, parent, isMain) {
		let key = request;
		try {
			key = Module._resolveFilename(request, parent, isMain);
		} catch (err) {
			key = request;
		}

		if (resolvedMocks.has(key)) {
			return resolvedMocks.get(key);
		}

		return originalLoad.apply(this, arguments);
	};

	try {
		return require(resolvedTarget);
	} finally {
		Module._load = originalLoad;
	}
}

module.exports = {
	loadWithMocks
};
