import Ember from "ember";
import loadEmberExam from "ember-exam/test-support/load";
import { start } from "ember-qunit";
import * as QUnit from "qunit";
import { setup } from "qunit-dom";
import setupTests from "discourse/tests/setup-tests";
import config from "../config/environment";

document.addEventListener("discourse-init", () => {
  // eslint-disable-next-line no-undef
  if (!EmberENV.TESTS_FILE_LOADED) {
    throw new Error(
      'The tests file was not loaded. Make sure your tests index.html includes "assets/tests.js".'
    );
  }

  const script = document.getElementById("plugin-test-script");
  if (script && !requirejs.entries["discourse/tests/plugin-tests"]) {
    throw new Error(
      `Plugin JS payload failed to load from ${script.src}. Is the Rails server running?`
    );
  }

  const params = new URLSearchParams(window.location.search);
  const target = params.get("target");
  const testingTheme = !!document.querySelector("script[data-theme-id]");
  const testingCore = !testingTheme && (!target || target === "core");
  const disableAutoStart = params.get("qunit_disable_auto_start") === "1";

  Ember.ENV.LOG_STACKTRACE_ON_DEPRECATION = false;

  document.body.insertAdjacentHTML(
    "afterbegin",
    `
      <div id="qunit"></div>
      <div id="qunit-fixture"></div>
      <div id="ember-testing-container" style="position: fixed">
        <div id="ember-testing"></div>
      </div>
    `
  );

  setup(QUnit.assert);
  setupTests(config.APP);
  let loader = loadEmberExam();

  if (QUnit.config.seed === undefined) {
    // If we're running in browser, default to random order. Otherwise, let Ember Exam
    // handle randomization.
    QUnit.config.seed = Math.random().toString(36).slice(2);
  } else {
    // Don't reorder when specifying a seed
    QUnit.config.reorder = false;
  }

  loader.loadModules();

  start({
    setupTestContainer: false,
    loadTests: false,
    startTests: !disableAutoStart,
    setupEmberOnerrorValidation: testingCore,
    setupTestIsolationValidation: true,
  });
});

window.EmberENV.TESTS_FILE_LOADED = true;
