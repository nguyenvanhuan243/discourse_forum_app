import { action } from "@ember/object";
import Mixin from "@ember/object/mixin";
import { next, schedule } from "@ember/runloop";
import { isEmpty } from "@ember/utils";
import { generateLinkifyFunction } from "discourse/lib/text";
import toMarkdown from "discourse/lib/to-markdown";
import {
  clipboardHelpers,
  determinePostReplaceSelection,
} from "discourse/lib/utilities";
import { isTesting } from "discourse-common/config/environment";
import { bind } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

const INDENT_DIRECTION_LEFT = "left";
const INDENT_DIRECTION_RIGHT = "right";

const OP = {
  NONE: 0,
  REMOVED: 1,
  ADDED: 2,
};

// Our head can be a static string or a function that returns a string
// based on input (like for numbered lists).
export function getHead(head, prev) {
  if (typeof head === "string") {
    return [head, head.length];
  } else {
    return getHead(head(prev));
  }
}

export default Mixin.create({
  init() {
    this._super(...arguments);

    // fallback in the off chance someone has implemented a custom composer
    // which does not define this
    if (!this.composerEventPrefix) {
      this.composerEventPrefix = "composer";
    }

    generateLinkifyFunction(this.markdownOptions || {}).then((linkify) => {
      // When pasting links, we should use the same rules to match links as we do when creating links for a cooked post.
      this._cachedLinkify = linkify;
    });
  },

  // ensures textarea scroll position is correct
  focusTextArea() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }

    if (!this._textarea) {
      return;
    }

    this._textarea.blur();
    this._textarea.focus();
  },

  insertBlock(text) {
    this._addBlock(this.getSelected(), text);
  },

  insertText(text, options) {
    this.addText(this.getSelected(), text, options);
  },

  getSelected(trimLeading, opts) {
    if (!this.ready || !this.element) {
      return;
    }

    const value = this._textarea.value;
    let start = this._textarea.selectionStart;
    let end = this._textarea.selectionEnd;

    // trim trailing spaces cause **test ** would be invalid
    while (end > start && /\s/.test(value.charAt(end - 1))) {
      end--;
    }

    if (trimLeading) {
      // trim leading spaces cause ** test** would be invalid
      while (end > start && /\s/.test(value.charAt(start))) {
        start++;
      }
    }

    const selVal = value.substring(start, end);
    const pre = value.slice(0, start);
    const post = value.slice(end);

    if (opts && opts.lineVal) {
      const lineVal =
        value.split("\n")[
          value.slice(0, this._textarea.selectionStart).split("\n").length - 1
        ];
      return { start, end, value: selVal, pre, post, lineVal };
    } else {
      return { start, end, value: selVal, pre, post };
    }
  },

  selectText(from, length, opts = { scroll: true }) {
    next(() => {
      if (!this.element) {
        return;
      }

      this._textarea.selectionStart = from;
      this._textarea.selectionEnd = from + length;
      if (opts.scroll) {
        const oldScrollPos = this._textarea.scrollTop;
        if (!this.capabilities.isIOS) {
          this._textarea.focus();
        }
        this._textarea.scrollTop = oldScrollPos;
      }
    });
  },

  replaceText(oldVal, newVal, opts = {}) {
    const val = this.value;
    const needleStart = val.indexOf(oldVal);

    if (needleStart === -1) {
      // Nothing to replace.
      return;
    }

    // Determine post-replace selection.
    const newSelection = determinePostReplaceSelection({
      selection: {
        start: this._textarea.selectionStart,
        end: this._textarea.selectionEnd,
      },
      needle: { start: needleStart, end: needleStart + oldVal.length },
      replacement: { start: needleStart, end: needleStart + newVal.length },
    });

    if (opts.index && opts.regex) {
      let i = -1;
      const newValue = val.replace(opts.regex, (match) => {
        i++;
        return i === opts.index ? newVal : match;
      });
      this.set("value", newValue);
    } else {
      // Replace value (side effect: cursor at the end).
      this.set("value", val.replace(oldVal, newVal));
    }

    if (
      (opts.forceFocus || this._$textarea.is(":focus")) &&
      !opts.skipNewSelection
    ) {
      // Restore cursor.
      this.selectText(
        newSelection.start,
        newSelection.end - newSelection.start
      );
    }
  },

  applySurround(sel, head, tail, exampleKey, opts) {
    const pre = sel.pre;
    const post = sel.post;

    const tlen = tail.length;
    if (sel.start === sel.end) {
      if (tlen === 0) {
        return;
      }

      const [hval, hlen] = getHead(head);
      const example = I18n.t(`composer.${exampleKey}`);
      this._insertAt(sel.start, sel.end, `${hval}${example}${tail}`);
      this.selectText(pre.length + hlen, example.length);
    } else if (opts && !opts.multiline) {
      let [hval, hlen] = getHead(head);

      if (opts.useBlockMode && sel.value.split("\n").length > 1) {
        hval += "\n";
        hlen += 1;
        tail = `\n${tail}`;
      }

      if (pre.slice(-hlen) === hval && post.slice(0, tail.length) === tail) {
        // Already wrapped in the surround. Remove it.
        this._insertAt(sel.start - hlen, sel.end + tail.length, sel.value);
        this.selectText(sel.start - hlen, sel.value.length);
      } else {
        this._insertAt(sel.start, sel.end, `${hval}${sel.value}${tail}`);
        this.selectText(sel.start + hlen, sel.value.length);
      }
    } else {
      const lines = sel.value.split("\n");

      let [hval, hlen] = getHead(head);
      if (
        lines.length === 1 &&
        pre.slice(-tlen) === tail &&
        post.slice(0, hlen) === hval
      ) {
        // Already wrapped in the surround. Remove it.
        this._insertAt(sel.start - hlen, sel.end + tlen, sel.value);
        this.selectText(sel.start - hlen, sel.value.length);
      } else {
        const contents = this._getMultilineContents(
          lines,
          head,
          hval,
          hlen,
          tail,
          tlen,
          opts
        );

        this._insertAt(sel.start, sel.end, contents);
        if (lines.length === 1 && tlen > 0) {
          this.selectText(sel.start + hlen, sel.value.length);
        } else {
          this.selectText(sel.start, contents.length);
        }
      }
    }
  },

  // perform the same operation over many lines of text
  _getMultilineContents(lines, head, hval, hlen, tail, tlen, opts) {
    let operation = OP.NONE;

    const applyEmptyLines = opts && opts.applyEmptyLines;

    return lines
      .map((l) => {
        if (!applyEmptyLines && l.length === 0) {
          return l;
        }

        if (
          operation !== OP.ADDED &&
          ((l.slice(0, hlen) === hval && tlen === 0) ||
            (tail.length && l.slice(-tlen) === tail))
        ) {
          operation = OP.REMOVED;
          if (tlen === 0) {
            const result = l.slice(hlen);
            [hval, hlen] = getHead(head, hval);
            return result;
          } else if (l.slice(-tlen) === tail) {
            const result = l.slice(hlen, -tlen);
            [hval, hlen] = getHead(head, hval);
            return result;
          }
        } else if (operation === OP.NONE) {
          operation = OP.ADDED;
        } else if (operation === OP.REMOVED) {
          return l;
        }

        const result = `${hval}${l}${tail}`;
        [hval, hlen] = getHead(head, hval);
        return result;
      })
      .join("\n");
  },

  _addBlock(sel, text) {
    text = (text || "").trim();
    if (text.length === 0) {
      return;
    }

    let start = sel.start;
    let end = sel.end;

    const newLinesBeforeSelection = sel.pre?.match(/\n*$/)?.[0]?.length;
    if (newLinesBeforeSelection) {
      start -= newLinesBeforeSelection;
    }

    if (sel.pre.length > 0) {
      text = `\n\n${text}`;
    }

    const newLinesAfterSelection = sel.post?.match(/^\n*/)?.[0]?.length;
    if (newLinesAfterSelection) {
      end += newLinesAfterSelection;
    }

    if (sel.post.length > 0) {
      text = `${text}\n\n`;
    } else {
      text = `${text}\n`;
    }

    this._insertAt(start, end, text);
    this._textarea.setSelectionRange(start + text.length, start + text.length);
    schedule("afterRender", this, this.focusTextArea);
  },

  addText(sel, text, options) {
    if (options && options.ensureSpace) {
      if ((sel.pre + "").length > 0) {
        if (!sel.pre.match(/\s$/)) {
          text = " " + text;
        }
      }
      if ((sel.post + "").length > 0) {
        if (!sel.post.match(/^\s/)) {
          text = text + " ";
        }
      }
    }

    this._insertAt(sel.start, sel.end, text);
    this.focusTextArea();
  },

  _insertAt(start, end, text) {
    this._textarea.setSelectionRange(start, end);
    this._textarea.focus();
    document.execCommand("insertText", false, text);
  },

  extractTable(text) {
    if (text.endsWith("\n")) {
      text = text.substring(0, text.length - 1);
    }

    text = text.split("");
    let cell = false;
    text.forEach((char, index) => {
      if (char === "\n" && cell) {
        text[index] = "\r";
      }
      if (char === '"') {
        text[index] = "";
        cell = !cell;
      }
    });

    let rows = text.join("").replace(/\r/g, "<br>").split("\n");

    if (rows.length > 1) {
      const columns = rows.map((r) => r.split("\t").length);
      const isTable =
        columns.reduce((a, b) => a && columns[0] === b && b > 1) &&
        !(columns[0] === 2 && rows[0].split("\t")[0].match(/^•$|^\d+.$/)); // to skip tab delimited lists

      if (isTable) {
        const splitterRow = [...Array(columns[0])].map(() => "---").join("\t");
        rows.splice(1, 0, splitterRow);

        return (
          "|" + rows.map((r) => r.split("\t").join("|")).join("|\n|") + "|\n"
        );
      }
    }
    return null;
  },

  isInside(text, regex) {
    const matches = text.match(regex);
    return matches && matches.length % 2;
  },

  @bind
  paste(e) {
    const isComposer =
      document.querySelector(this.composerFocusSelector) === e.target;

    if (!isComposer && !isTesting()) {
      return;
    }

    let { clipboard, canPasteHtml, canUpload } = clipboardHelpers(e, {
      siteSettings: this.siteSettings,
      canUpload: isComposer,
    });

    let plainText = clipboard.getData("text/plain");
    let html = clipboard.getData("text/html");
    let handled = false;

    const selected = this.getSelected(null, { lineVal: true });
    const { pre, value: selectedValue, lineVal } = selected;
    const isInlinePasting = pre.match(/[^\n]$/);
    const isCodeBlock = this.isInside(pre, /(^|\n)```/g);

    if (
      plainText &&
      this.siteSettings.enable_rich_text_paste &&
      !isInlinePasting &&
      !isCodeBlock
    ) {
      plainText = plainText.replace(/\r/g, "");
      const table = this.extractTable(plainText);
      if (table) {
        this.composerEventPrefix
          ? this.appEvents.trigger(
              `${this.composerEventPrefix}:insert-text`,
              table
            )
          : this.insertText(table);
        handled = true;
      }
    }

    if (canPasteHtml && plainText) {
      if (isInlinePasting) {
        canPasteHtml = !(
          lineVal.match(/^```/) ||
          this.isInside(pre, /`/g) ||
          lineVal.match(/^    /)
        );
      } else {
        canPasteHtml = !isCodeBlock;
      }
    }

    if (
      this._cachedLinkify &&
      plainText &&
      !handled &&
      selected.end > selected.start &&
      // text selection does not contain url
      !this._cachedLinkify.test(selectedValue) &&
      // text selection does not contain a bbcode-like tag
      !selectedValue.match(/\[\/?[a-z =]+?\]/g)
    ) {
      if (this._cachedLinkify.test(plainText)) {
        const match = this._cachedLinkify.match(plainText)[0];
        if (
          match &&
          match.index === 0 &&
          match.lastIndex === match.raw.length
        ) {
          // When specified, linkify supports fuzzy links and emails. Prefer providing the protocol.
          // eg: pasting "example@discourse.org" may apply a link format of "mailto:example@discourse.org"
          this.addText(selected, `[${selectedValue}](${match.url})`);
          handled = true;
        }
      }
    }

    if (canPasteHtml && !handled) {
      let markdown = toMarkdown(html);

      if (!plainText || plainText.length < markdown.length) {
        if (isInlinePasting) {
          markdown = markdown.replace(/^#+/, "").trim();
          markdown = pre.match(/\S$/) ? ` ${markdown}` : markdown;
        }

        if (isComposer) {
          this.composerEventPrefix
            ? this.appEvents.trigger(
                `${this.composerEventPrefix}:insert-text`,
                markdown
              )
            : this.insertText(markdown);
          handled = true;
        }
      }
    }

    if (handled || (canUpload && !plainText)) {
      e.preventDefault();
    }
  },

  /**
   * Removes the provided char from the provided str up
   * until the limit, or until a character that is _not_
   * the provided one is encountered.
   */
  _deindentLine(str, char, limit) {
    let eaten = 0;
    for (let i = 0; i < str.length; i++) {
      if (eaten < limit && str[i] === char) {
        eaten += 1;
      } else {
        return str.slice(eaten);
      }
    }
    return str;
  },

  @bind
  indentSelection(direction) {
    if (![INDENT_DIRECTION_LEFT, INDENT_DIRECTION_RIGHT].includes(direction)) {
      return;
    }

    const selected = this.getSelected(null, { lineVal: true });
    const { lineVal } = selected;
    let value = selected.value;

    // Perhaps this is a bit simplistic, but it is a fairly reliable
    // guess to say whether we are indenting with tabs or spaces. for
    // example some programming languages prefer tabs, others prefer
    // spaces, and for the cases with no tabs it's safer to use spaces
    let indentationSteps, indentationChar;
    let linesStartingWithTabCount = value.match(/^\t/gm)?.length || 0;
    let linesStartingWithSpaceCount = value.match(/^ /gm)?.length || 0;
    if (linesStartingWithTabCount > linesStartingWithSpaceCount) {
      indentationSteps = 1;
      indentationChar = "\t";
    } else {
      indentationChar = " ";
      indentationSteps = 2;
    }

    // We want to include all the spaces on the selected line as
    // well, no matter where the cursor begins on the first line,
    // because we want to indent those too. * is the cursor/selection
    // and . are spaces:
    //
    // BEFORE               AFTER
    //
    //     *                *
    // ....text here        ....text here
    // ....some more text   ....some more text
    //                  *                    *
    //
    // BEFORE               AFTER
    //
    //  *                   *
    // ....text here        ....text here
    // ....some more text   ....some more text
    //                  *                    *
    const indentationRegexp = new RegExp(`^${indentationChar}+`);
    const lineStartsWithIndentationChar = lineVal.match(indentationRegexp);
    const indentationCharsBeforeSelection = value.match(indentationRegexp);
    if (lineStartsWithIndentationChar) {
      const charsToSubtract = indentationCharsBeforeSelection
        ? indentationCharsBeforeSelection[0]
        : "";
      value =
        lineStartsWithIndentationChar[0].replace(charsToSubtract, "") + value;
    }

    const splitSelection = value.split("\n");
    const newValue = splitSelection
      .map((line) => {
        if (direction === INDENT_DIRECTION_LEFT) {
          return this._deindentLine(line, indentationChar, indentationSteps);
        } else {
          return `${Array(indentationSteps + 1).join(indentationChar)}${line}`;
        }
      })
      .join("\n");

    if (newValue.trim() !== "") {
      this.replaceText(value, newValue, { skipNewSelection: true });
      this.selectText(this.value.indexOf(newValue), newValue.length);
    }
  },

  @action
  emojiSelected(code) {
    let selected = this.getSelected();
    const captures = selected.pre.match(/\B:(\w*)$/);

    if (isEmpty(captures)) {
      if (selected.pre.match(/\S$/)) {
        this.addText(selected, ` :${code}:`);
      } else {
        this.addText(selected, `:${code}:`);
      }
    } else {
      let numOfRemovedChars = captures[1].length;
      this._insertAt(
        selected.start - numOfRemovedChars,
        selected.end,
        `${code}:`
      );
    }
  },
});
