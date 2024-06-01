import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { create } from "virtual-dom";
import loadScript from "discourse/lib/load-script";
import { iconNode } from "discourse-common/lib/icon-library";
import { afterRender } from "discourse-common/utils/decorators";

export default class JsonSchemaEditorModal extends Component {
  @tracked editor = null;
  @tracked value = this.args.model.value;
  @tracked flash;
  @tracked flashType;

  get settingName() {
    return this.args.model.settingName.replace(/\_/g, " ");
  }

  @action
  buildJsonEditor(editor) {
    loadScript("/javascripts/jsoneditor.js").then(
      this._loadEditor.bind(this, editor)
    );
  }

  @action
  teardownJsonEditor() {
    this.editor?.destroy();
  }

  @action
  saveChanges() {
    const errors = this.editor.validate();

    if (!errors.length) {
      this.value = JSON.stringify(this.editor.getValue());
      this.args.model.updateValue(this.value);
      this.args.closeModal();
    } else {
      this.flash = errors.mapBy("message").join("\n");
      this.flashType = "error";
    }
  }

  @afterRender
  _loadEditor(editor) {
    let { JSONEditor } = window;

    JSONEditor.defaults.options.theme = "barebones";
    JSONEditor.defaults.iconlibs = {
      discourseIcons: DiscourseJsonSchemaEditorIconlib,
    };
    JSONEditor.defaults.options.iconlib = "discourseIcons";

    this.editor = new JSONEditor(editor, {
      schema: this.args.model.jsonSchema,
      disable_array_delete_all_rows: true,
      disable_array_delete_last_row: true,
      disable_array_reorder: false,
      disable_array_copy: false,
      enable_array_copy: true,
      disable_edit_json: true,
      disable_properties: true,
      disable_collapse: false,
      show_errors: "never",
      startval: this.value ? JSON.parse(this.value) : null,
    });
  }
}

class DiscourseJsonSchemaEditorIconlib {
  constructor() {
    this.mapping = {
      delete: "trash-alt",
      add: "plus",
      moveup: "arrow-up",
      movedown: "arrow-down",
      moveleft: "chevron-left",
      moveright: "chevron-right",
      copy: "copy",
      collapse: "chevron-down",
      expand: "chevron-up",
    };
  }

  getIcon(key) {
    if (!this.mapping[key]) {
      return;
    }
    return create(iconNode(this.mapping[key]));
  }
}
