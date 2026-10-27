/** @type {import("lint-staged").Configuration} */
const config = {
  "*.{ts,tsx,js,jsx,mjs,mts}": [
    // --no-warn-ignored: committed-but-ignored files (e.g. generated schema.d.ts) must not block commits.
    "eslint --max-warnings=0 --no-warn-ignored --fix",
    "prettier --write",
  ],
  "*.{json,md,css,yml,yaml}": "prettier --write",
};

export default config;
