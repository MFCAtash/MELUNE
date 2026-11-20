module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.module.ts",
    "!**/*.dto.ts",
    "!**/*.controller.ts", // thin HTTP wrappers — covered by the e2e suite, not unit tests
    "!main.ts",
  ],
  coverageDirectory: "../coverage",
  coverageReporters: ["text", "text-summary", "lcov"],
  testEnvironment: "node",
  // Minimum line coverage across apps/api/src. Enforced in CI via
  // `jest --coverage`; a drop below this fails the pipeline instead of
  // silently shipping untested catalog/library/storage/admin code.
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
  // Per-file floors were intentionally removed: Jest resolves threshold keys
  // against absolute paths on Windows, so keys like "./search/search.service.ts"
  // produced "coverage data not found" even though those services are at 100%.
  // The global 70% floor still fails CI on a coverage regression.
};
