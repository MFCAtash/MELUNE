/** API lint config — extends the shared base in packages/config. */
module.exports = {
  root: true,
  extends: [require.resolve("../../packages/config/eslint-base.js")],
  env: { node: true, jest: true },
  ignorePatterns: [".eslintrc.js", "dist/", "coverage/", "node_modules/"],
  rules: {
    // Nest DI + DTO classes legitimately use empty constructors/classes.
    "@typescript-eslint/no-empty-function": "off",
  },
};
