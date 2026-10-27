/** @type {import("lint-staged").Configuration} */
const config = {
  "*.{ts,tsx,js,jsx,mjs,mts}": [
    "eslint --max-warnings=0 --fix",
    "prettier --write",
  ],
  "*.{json,md,css,yml,yaml}": "prettier --write",
};

export default config;
