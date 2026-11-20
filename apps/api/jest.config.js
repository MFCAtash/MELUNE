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
    // Previously untested (0% coverage, manual-mock specs added):
    // search/discover/notifications/push were dragging the global average
    // down. Pinning a per-file floor here means a future regression in any
    // one of them fails CI on its own, even if the overall average still
    // clears 70%.
    "./search/search.service.ts": {
      lines: 70,
    },
    "./discover/discover.service.ts": {
      lines: 70,
    },
    "./notifications/notifications.service.ts": {
      lines: 70,
    },
    "./push/push.service.ts": {
      lines: 70,
    },
  },
};
