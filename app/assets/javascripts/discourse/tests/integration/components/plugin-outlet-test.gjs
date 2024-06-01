import Component from "@glimmer/component";
import { getOwner } from "@ember/application";
import templateOnly from "@ember/component/template-only";
import { click, render, settled } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import sinon from "sinon";
import {
  extraConnectorClass,
  extraConnectorComponent,
} from "discourse/lib/plugin-connectors";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { count, exists, query } from "discourse/tests/helpers/qunit-helpers";
import { registerTemporaryModule } from "discourse/tests/helpers/temporary-module-helper";
import {
  withSilencedDeprecations,
  withSilencedDeprecationsAsync,
} from "discourse-common/lib/deprecated";

const TEMPLATE_PREFIX = "discourse/plugins/some-plugin/templates/connectors";
const CLASS_PREFIX = "discourse/plugins/some-plugin/connectors";

module("Integration | Component | plugin-outlet", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    registerTemporaryModule(`${CLASS_PREFIX}/test-name/hello`, {
      actions: {
        sayHello() {
          this.set("hello", `${this.hello || ""}hello!`);
        },
      },
    });

    registerTemporaryModule(`${CLASS_PREFIX}/test-name/hi`, {
      setupComponent() {
        this.appEvents.on("hi:sayHi", this, this.say);
      },

      teardownComponent() {
        this.appEvents.off("hi:sayHi", this, this.say);
      },

      actions: {
        say() {
          this.set("hi", "hi!");
        },

        sayHi() {
          this.appEvents.trigger("hi:sayHi");
        },
      },
    });

    registerTemporaryModule(`${CLASS_PREFIX}/test-name/conditional-render`, {
      shouldRender(args, context) {
        return args.shouldDisplay || context.siteSettings.always_display;
      },
    });

    registerTemporaryModule(
      `${TEMPLATE_PREFIX}/test-name/hello`,
      hbs`<span class='hello-username'>{{this.username}}</span>
        <button type="button" class='say-hello' {{on "click" (action "sayHello")}}></button>
        <button type="button" class='say-hello-using-this' {{on "click" this.sayHello}}></button>
        <span class='hello-result'>{{this.hello}}</span>`
    );
    registerTemporaryModule(
      `${TEMPLATE_PREFIX}/test-name/hi`,
      hbs`<button type="button" class='say-hi' {{on "click" (action "sayHi")}}></button>
        <span class='hi-result'>{{this.hi}}</span>`
    );
    registerTemporaryModule(
      `${TEMPLATE_PREFIX}/test-name/conditional-render`,
      hbs`<span class="conditional-render">I only render sometimes</span>`
    );

    registerTemporaryModule(
      `${TEMPLATE_PREFIX}/outlet-with-default/my-connector`,
      hbs`<span class='result'>Plugin implementation{{#if @outletArgs.yieldCore}} {{yield}}{{/if}}</span>`
    );
    registerTemporaryModule(
      `${TEMPLATE_PREFIX}/outlet-with-default/clashing-connector`,
      hbs`This will override my-connector and raise an error`
    );
  });

  test("Renders a template into the outlet", async function (assert) {
    this.set("shouldDisplay", false);
    await render(
      hbs`<PluginOutlet @name="test-name" @outletArgs={{hash shouldDisplay=this.shouldDisplay}} />`
    );
    assert.strictEqual(count(".hello-username"), 1, "renders the hello outlet");
    assert.false(
      exists(".conditional-render"),
      "doesn't render conditional outlet"
    );

    await click(".say-hello");
    assert.strictEqual(
      query(".hello-result").innerText,
      "hello!",
      "actions delegate properly"
    );
    await click(".say-hello-using-this");
    assert.strictEqual(
      query(".hello-result").innerText,
      "hello!hello!",
      "actions are made available on `this` and are bound correctly"
    );

    await click(".say-hi");
    assert.strictEqual(
      query(".hi-result").innerText,
      "hi!",
      "actions delegate properly"
    );
  });

  module(
    "as a wrapper around a default core implementation",
    function (innerHooks) {
      innerHooks.beforeEach(function () {
        this.consoleErrorStub = sinon.stub(console, "error");

        this.set("shouldDisplay", false);
        this.set("yieldCore", false);
        this.set("enableClashingConnector", false);

        registerTemporaryModule(
          `${CLASS_PREFIX}/outlet-with-default/my-connector`,
          {
            shouldRender(args) {
              return args.shouldDisplay;
            },
          }
        );

        registerTemporaryModule(
          `${CLASS_PREFIX}/outlet-with-default/clashing-connector`,
          {
            shouldRender(args) {
              return args.enableClashingConnector;
            },
          }
        );

        this.template = hbs`
      <PluginOutlet @name="outlet-with-default" @outletArgs={{hash shouldDisplay=this.shouldDisplay yieldCore=this.yieldCore enableClashingConnector=this.enableClashingConnector}}>
        <span class='result'>Core implementation</span>
      </PluginOutlet>
    `;
      });

      test("Can act as a wrapper around core implementation", async function (assert) {
        await render(this.template);

        assert.dom(".result").hasText("Core implementation");

        this.set("shouldDisplay", true);
        await settled();

        assert.dom(".result").hasText("Plugin implementation");

        this.set("yieldCore", true);
        await settled();

        assert
          .dom(".result")
          .hasText("Plugin implementation Core implementation");

        assert.strictEqual(
          this.consoleErrorStub.callCount,
          0,
          "no errors in console"
        );
      });

      test("clashing connectors for regular users", async function (assert) {
        await render(this.template);

        this.set("shouldDisplay", true);
        this.set("enableClashingConnector", true);
        await settled();

        assert.strictEqual(
          this.consoleErrorStub.callCount,
          1,
          "clash error reported to console"
        );

        assert.true(
          this.consoleErrorStub
            .getCall(0)
            .args[0].includes("Multiple connectors"),
          "console error includes message about multiple connectors"
        );

        assert
          .dom(".broken-theme-alert-banner")
          .doesNotExist("Banner is not shown to regular users");
      });

      test("clashing connectors for admins", async function (assert) {
        this.set("currentUser.admin", true);
        await render(this.template);

        this.set("shouldDisplay", true);
        this.set("enableClashingConnector", true);
        await settled();

        assert.strictEqual(
          this.consoleErrorStub.callCount,
          1,
          "clash error reported to console"
        );

        assert.true(
          this.consoleErrorStub
            .getCall(0)
            .args[0].includes("Multiple connectors"),
          "console error includes message about multiple connectors"
        );

        assert
          .dom(".broken-theme-alert-banner")
          .exists("Error banner is shown to admins");
      });

      test("can render content in a automatic outlet generated before the wrapped content", async function (assert) {
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__before/my-connector`,
          hbs`<span class='before-result'>Before wrapped content</span>`
        );

        await render(hbs`
          <PluginOutlet @name="outlet-with-default" @outletArgs={{hash shouldDisplay=true}}>
            <span class='result'>Core implementation</span>
          </PluginOutlet>
        `);

        assert.dom(".result").hasText("Plugin implementation");
        assert.dom(".before-result").hasText("Before wrapped content");
      });

      test("can render multiple connector `before` the same wrapped content", async function (assert) {
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__before/my-connector`,
          hbs`<span class='before-result'>First connector before the wrapped content</span>`
        );
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__before/my-connector2`,
          hbs`<span class='before-result2'>Second connector before the wrapped content</span>`
        );

        await render(hbs`
          <PluginOutlet @name="outlet-with-default" @outletArgs={{hash shouldDisplay=true}}>
            <span class='result'>Core implementation</span>
          </PluginOutlet>
        `);

        assert.dom(".result").hasText("Plugin implementation");
        assert
          .dom(".before-result")
          .hasText("First connector before the wrapped content");
        assert
          .dom(".before-result2")
          .hasText("Second connector before the wrapped content");
      });

      test("can render content in a automatic outlet generated after the wrapped content", async function (assert) {
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__after/my-connector`,
          hbs`<span class='after-result'>After wrapped content</span>`
        );

        await render(hbs`
          <PluginOutlet @name="outlet-with-default" @outletArgs={{hash shouldDisplay=true}}>
            <span class='result'>Core implementation</span>
          </PluginOutlet>
        `);

        assert.dom(".result").hasText("Plugin implementation");
        assert.dom(".after-result").hasText("After wrapped content");
      });

      test("can render multiple connector `after` the same wrapped content", async function (assert) {
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__after/my-connector`,
          hbs`<span class='after-result'>First connector after the wrapped content</span>`
        );
        registerTemporaryModule(
          `${TEMPLATE_PREFIX}/outlet-with-default__after/my-connector2`,
          hbs`<span class='after-result2'>Second connector after the wrapped content</span>`
        );

        await render(hbs`
          <PluginOutlet @name="outlet-with-default" @outletArgs={{hash shouldDisplay=true}}>
            <span class='result'>Core implementation</span>
          </PluginOutlet>
        `);

        assert.dom(".result").hasText("Plugin implementation");
        assert
          .dom(".after-result")
          .hasText("First connector after the wrapped content");
        assert
          .dom(".after-result2")
          .hasText("Second connector after the wrapped content");
      });
    }
  );

  test("Renders wrapped implementation if no connectors are registered", async function (assert) {
    await render(
      hbs`
        <PluginOutlet @name="outlet-with-no-registrations">
          <span class='result'>Core implementation</span>
        </PluginOutlet>
      `
    );

    assert.dom(".result").hasText("Core implementation");
  });

  test("Reevaluates shouldRender for argument changes", async function (assert) {
    this.set("shouldDisplay", false);
    await render(
      hbs`<PluginOutlet @name="test-name" @outletArgs={{hash shouldDisplay=this.shouldDisplay}} />`
    );
    assert.false(
      exists(".conditional-render"),
      "doesn't render conditional outlet"
    );

    this.set("shouldDisplay", true);
    await settled();
    assert.true(exists(".conditional-render"), "renders conditional outlet");
  });

  test("Reevaluates shouldRender for other autotracked changes", async function (assert) {
    this.set("shouldDisplay", false);
    await render(
      hbs`<PluginOutlet @name="test-name" @outletArgs={{hash shouldDisplay=this.shouldDisplay}} />`
    );
    assert.false(
      exists(".conditional-render"),
      "doesn't render conditional outlet"
    );

    getOwner(this).lookup("service:site-settings").always_display = true;
    await settled();
    assert.true(exists(".conditional-render"), "renders conditional outlet");
  });

  test("Other outlets are not re-rendered", async function (assert) {
    this.set("shouldDisplay", false);
    await render(
      hbs`<PluginOutlet @name="test-name" @outletArgs={{hash shouldDisplay=this.shouldDisplay}} />`
    );

    const otherOutletElement = query(".hello-username");
    otherOutletElement.someUniqueProperty = true;

    this.set("shouldDisplay", true);
    await settled();
    assert.true(exists(".conditional-render"), "renders conditional outlet");

    assert.true(
      query(".hello-username").someUniqueProperty,
      "other outlet is left untouched"
    );
  });
});

module(
  "Integration | Component | plugin-outlet | connector class definitions",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      registerTemporaryModule(
        `${TEMPLATE_PREFIX}/test-name/my-connector`,
        hbs`<span class='outletArgHelloValue'>{{@outletArgs.hello}}</span><span class='thisHelloValue'>{{this.hello}}</span>`
      );
    });

    test("uses classic PluginConnector by default", async function (assert) {
      await render(
        hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world"}} />`
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText("world");
    });

    test("uses templateOnly by default when @defaultGlimmer=true", async function (assert) {
      await render(
        hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world"}} @defaultGlimmer={{true}} />`
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText(""); // `this.` unavailable in templateOnly components
    });

    test("uses simple object if provided", async function (assert) {
      this.set("someBoolean", true);

      registerTemporaryModule(`${CLASS_PREFIX}/test-name/my-connector`, {
        shouldRender(args) {
          return args.someBoolean;
        },

        setupComponent(args, component) {
          component.reopen({
            get hello() {
              return args.hello + " from setupComponent";
            },
          });
        },
      });

      await render(
        hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world" someBoolean=this.someBoolean}} />`
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText("world from setupComponent");

      this.set("someBoolean", false);
      await settled();

      assert.dom(".outletArgHelloValue").doesNotExist();
    });

    test("ignores classic hooks for glimmer components", async function (assert) {
      registerTemporaryModule(`${CLASS_PREFIX}/test-name/my-connector`, {
        setupComponent(args, component) {
          component.reopen({
            get hello() {
              return args.hello + " from setupComponent";
            },
          });
        },
      });

      await withSilencedDeprecationsAsync(
        "discourse.plugin-outlet-classic-hooks",
        async () => {
          await render(
            hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world"}} @defaultGlimmer={{true}} />`
          );
        }
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText("");
    });

    test("uses custom component class if provided", async function (assert) {
      this.set("someBoolean", true);

      registerTemporaryModule(
        `${CLASS_PREFIX}/test-name/my-connector`,
        class MyOutlet extends Component {
          static shouldRender(args) {
            return args.someBoolean;
          }

          get hello() {
            return this.args.outletArgs.hello + " from custom component";
          }
        }
      );

      await render(
        hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world" someBoolean=this.someBoolean}} />`
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText("world from custom component");

      this.set("someBoolean", false);
      await settled();

      assert.dom(".outletArgHelloValue").doesNotExist();
    });

    test("uses custom templateOnly() if provided", async function (assert) {
      this.set("someBoolean", true);

      registerTemporaryModule(
        `${CLASS_PREFIX}/test-name/my-connector`,
        Object.assign(templateOnly(), {
          shouldRender(args) {
            return args.someBoolean;
          },
        })
      );

      await render(
        hbs`<PluginOutlet @name="test-name" @outletArgs={{hash hello="world" someBoolean=this.someBoolean}} />`
      );

      assert.dom(".outletArgHelloValue").hasText("world");
      assert.dom(".thisHelloValue").hasText(""); // `this.` unavailable in templateOnly components

      this.set("someBoolean", false);
      await settled();

      assert.dom(".outletArgHelloValue").doesNotExist();
    });
  }
);

module(
  "Integration | Component | plugin-outlet | gjs class definitions",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      registerTemporaryModule(
        `${CLASS_PREFIX}/test-name/my-connector`,
        <template><span class="gjs-test">Hello world</span></template>
      );
    });

    test("detects a gjs connector with no associated template file", async function (assert) {
      await render(hbs`<PluginOutlet @name="test-name" />`);

      assert.dom(".gjs-test").hasText("Hello world");
    });
  }
);

module(
  "Integration | Component | plugin-outlet | extraConnectorComponent",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      extraConnectorComponent("test-name", <template>
        <span class="gjs-test">Hello world from gjs</span>
      </template>);
    });

    test("renders the component in the outlet", async function (assert) {
      await render(hbs`<PluginOutlet @name="test-name" />`);
      assert.dom(".gjs-test").hasText("Hello world from gjs");
    });

    test("throws errors for invalid components", function (assert) {
      assert.throws(() => {
        extraConnectorComponent("test-name/blah", <template>
          hello world
        </template>);
      }, /invalid outlet name/);

      assert.throws(() => {
        extraConnectorComponent("test-name", {});
      }, /klass is not an Ember component/);

      assert.throws(() => {
        extraConnectorComponent("test-name", class extends Component {});
      }, /connector component has no associated template/);
    });
  }
);

module("Integration | Component | plugin-outlet | tagName", function (hooks) {
  setupRenderingTest(hooks);

  test("supports the `@tagName` argument", async function (assert) {
    await withSilencedDeprecationsAsync(
      "discourse.plugin-outlet-tag-name",
      async () =>
        await render(hbs`<PluginOutlet @name="test-name" @tagName="div" />`)
    );
    assert.dom("div").exists();
  });
});

module(
  "Integration | Component | plugin-outlet | legacy extraConnectorClass",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      registerTemporaryModule(
        `${TEMPLATE_PREFIX}/test-name/my-legacy-connector`,
        hbs`<span class='legacy-test'>Hello world {{this.someVar}}</span>`
      );

      withSilencedDeprecations(
        "discourse.register-connector-class-legacy",
        () =>
          extraConnectorClass("test-name/my-legacy-connector", {
            setupComponent(outletArgs, component) {
              component.set("someVar", "from legacy");
            },
          })
      );
    });

    test("links up template with extra connector class", async function (assert) {
      await render(hbs`<PluginOutlet @name="test-name" />`);
      assert.dom(".legacy-test").hasText("Hello world from legacy");
    });
  }
);
