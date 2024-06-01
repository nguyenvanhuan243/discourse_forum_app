import { getOwner } from "@ember/application";
import { h } from "virtual-dom";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { relativeAge } from "discourse/lib/formatter";
import loadScript from "discourse/lib/load-script";
import { applyLocalDates } from "discourse/lib/local-dates";
import round from "discourse/lib/round";
import hbs from "discourse/widgets/hbs-compiler";
import { avatarFor } from "discourse/widgets/post";
import RawHtml from "discourse/widgets/raw-html";
import { createWidget } from "discourse/widgets/widget";
import { iconHTML, iconNode } from "discourse-common/lib/icon-library";
import I18n from "discourse-i18n";
import { getColors } from "discourse/plugins/poll/lib/chart-colors";
import evenRound from "discourse/plugins/poll/lib/even-round";
import PollBreakdownModal from "../components/modal/poll-breakdown";
import { PIE_CHART_TYPE } from "../components/modal/poll-ui-builder";

const FETCH_VOTERS_COUNT = 25;

const buttonOptionsMap = {
  exportResults: {
    className: "btn-default export-results",
    label: "poll.export-results.label",
    title: "poll.export-results.title",
    icon: "download",
    action: "exportResults",
  },
  showBreakdown: {
    className: "btn-default show-breakdown",
    label: "poll.breakdown.breakdown",
    icon: "chart-pie",
    action: "showBreakdown",
  },
  openPoll: {
    className: "btn-default toggle-status",
    label: "poll.open.label",
    title: "poll.open.title",
    icon: "unlock-alt",
    action: "toggleStatus",
  },
  closePoll: {
    className: "btn-default toggle-status",
    label: "poll.close.label",
    title: "poll.close.title",
    icon: "lock",
    action: "toggleStatus",
  },
};

function optionHtml(option, siteSettings = {}) {
  const el = document.createElement("span");
  el.innerHTML = option.html;
  applyLocalDates(el.querySelectorAll(".discourse-local-date"), siteSettings);
  return new RawHtml({ html: `<span>${el.innerHTML}</span>` });
}

function checkUserGroups(user, poll) {
  const pollGroups =
    poll && poll.groups && poll.groups.split(",").map((g) => g.toLowerCase());

  if (!pollGroups) {
    return true;
  }

  const userGroups =
    user && user.groups && user.groups.map((g) => g.name.toLowerCase());

  return userGroups && pollGroups.some((g) => userGroups.includes(g));
}

createWidget("discourse-poll-option", {
  tagName: "li",

  buildAttributes(attrs) {
    return { tabindex: 0, "data-poll-option-id": attrs.option.id };
  },

  html(attrs) {
    const contents = [];
    const { option, vote } = attrs;
    const chosen = vote.includes(option.id);

    if (attrs.isMultiple) {
      contents.push(iconNode(chosen ? "far-check-square" : "far-square"));
    } else {
      contents.push(iconNode(chosen ? "circle" : "far-circle"));
    }

    contents.push(" ");
    contents.push(optionHtml(option, this.siteSettings));

    return contents;
  },

  click(e) {
    if (!e.target.closest("a")) {
      this.sendWidgetAction("toggleOption", this.attrs.option);
    }
  },

  keyDown(e) {
    if (e.key === "Enter") {
      this.click(e);
    }
  },
});

createWidget("discourse-poll-load-more", {
  tagName: "div.poll-voters-toggle-expand",
  buildKey: (attrs) => `load-more-${attrs.optionId}`,

  defaultState() {
    return { loading: false };
  },

  html(attrs, state) {
    return state.loading
      ? h("div.spinner.small")
      : h("a", iconNode("chevron-down"));
  },

  click() {
    const { state, attrs } = this;

    if (state.loading) {
      return;
    }

    state.loading = true;
    return this.sendWidgetAction("fetchVoters", attrs.optionId).finally(
      () => (state.loading = false)
    );
  },
});

createWidget("discourse-poll-voters", {
  tagName: "ul.poll-voters-list",
  buildKey: (attrs) => `poll-voters-${attrs.optionId}`,

  html(attrs) {
    const contents = attrs.voters.map((user) =>
      h("li", [
        avatarFor("tiny", {
          username: user.username,
          template: user.avatar_template,
        }),
        " ",
      ])
    );

    if (attrs.voters.length < attrs.totalVotes) {
      contents.push(this.attach("discourse-poll-load-more", attrs));
    }

    return h("div.poll-voters", contents);
  },
});

createWidget("discourse-poll-standard-results", {
  tagName: "ul.results",
  buildKey: (attrs) => `poll-standard-results-${attrs.id}`,

  html(attrs) {
    const { poll } = attrs;
    const options = poll.options;

    if (options) {
      const voters = poll.voters;
      const isPublic = poll.public;

      const ordered = [...options].sort((a, b) => {
        if (a.votes < b.votes) {
          return 1;
        } else if (a.votes === b.votes) {
          if (a.html < b.html) {
            return -1;
          } else {
            return 1;
          }
        } else {
          return -1;
        }
      });

      const percentages =
        voters === 0
          ? Array(ordered.length).fill(0)
          : ordered.map((o) => (100 * o.votes) / voters);

      const rounded = attrs.isMultiple
        ? percentages.map(Math.floor)
        : evenRound(percentages);

      return ordered.map((option, idx) => {
        const contents = [];
        const per = rounded[idx].toString();
        const chosen = (attrs.vote || []).includes(option.id);

        contents.push(
          h(
            "div.option",
            h("p", [
              h("span.percentage", `${per}%`),
              optionHtml(option, this.siteSettings),
            ])
          )
        );

        contents.push(
          h(
            "div.bar-back",
            h("div.bar", { attributes: { style: `width:${per}%` } })
          )
        );

        if (isPublic) {
          contents.push(
            this.attach("discourse-poll-voters", {
              postId: attrs.post.id,
              optionId: option.id,
              pollName: poll.name,
              totalVotes: option.votes,
              voters: (attrs.voters && attrs.voters[option.id]) || [],
            })
          );
        }

        return h("li", { className: `${chosen ? "chosen" : ""}` }, contents);
      });
    }
  },
});

createWidget("discourse-poll-number-results", {
  buildKey: (attrs) => `poll-number-results-${attrs.id}`,

  html(attrs) {
    const { poll } = attrs;

    const totalScore = poll.options.reduce((total, o) => {
      return total + parseInt(o.html, 10) * parseInt(o.votes, 10);
    }, 0);

    const voters = poll.voters;
    const average = voters === 0 ? 0 : round(totalScore / voters, -2);
    const averageRating = I18n.t("poll.average_rating", { average });
    const contents = [
      h(
        "div.poll-results-number-rating",
        new RawHtml({ html: `<span>${averageRating}</span>` })
      ),
    ];

    if (poll.public) {
      contents.push(
        this.attach("discourse-poll-voters", {
          totalVotes: poll.voters,
          voters: attrs.voters || [],
          postId: attrs.post.id,
          pollName: poll.name,
          pollType: poll.type,
        })
      );
    }

    return contents;
  },
});

createWidget("discourse-poll-container", {
  tagName: "div.poll-container",
  buildKey: (attrs) => `poll-container-${attrs.id}`,
  services: ["dialog"],

  defaultState() {
    return { voters: [] };
  },

  html(attrs, state) {
    const { poll } = attrs;
    const options = poll.options;

    if (attrs.showResults) {
      const contents = [];

      if (attrs.titleHTML) {
        contents.push(new RawHtml({ html: attrs.titleHTML }));
      }

      if (poll.public) {
        state.voters = poll.preloaded_voters;
      }

      const type = poll.type === "number" ? "number" : "standard";
      const resultsWidget =
        type === "number" || attrs.poll.chart_type !== PIE_CHART_TYPE
          ? `discourse-poll-${type}-results`
          : "discourse-poll-pie-chart";
      contents.push(
        this.attach(resultsWidget, { ...attrs, voters: state.voters })
      );

      return contents;
    } else if (options) {
      const contents = [];

      if (attrs.titleHTML) {
        contents.push(new RawHtml({ html: attrs.titleHTML }));
      }

      if (!checkUserGroups(this.currentUser, poll)) {
        contents.push(
          h(
            "div.alert.alert-danger",
            I18n.t("poll.results.groups.title", { groups: poll.groups })
          )
        );
      }

      contents.push(
        h(
          "ul",
          options.map((option) => {
            return this.attach("discourse-poll-option", {
              option,
              isMultiple: attrs.isMultiple,
              vote: attrs.vote,
            });
          })
        )
      );

      return contents;
    }
  },

  fetchVoters(optionId) {
    const { attrs, state } = this;
    let votersCount;

    if (optionId) {
      if (!state.voters) {
        state.voters = {};
      }

      if (!state.voters[optionId]) {
        state.voters[optionId] = [];
      }

      votersCount = state.voters[optionId].length;
    } else {
      if (!state.voters) {
        state.voters = [];
      }

      votersCount = state.voters.length;
    }

    return ajax("/polls/voters.json", {
      data: {
        post_id: attrs.post.id,
        poll_name: attrs.poll.name,
        option_id: optionId,
        page: Math.floor(votersCount / FETCH_VOTERS_COUNT) + 1,
        limit: FETCH_VOTERS_COUNT,
      },
    })
      .then((result) => {
        const voters = optionId ? state.voters[optionId] : state.voters;
        const newVoters = optionId ? result.voters[optionId] : result.voters;

        const votersSet = new Set(voters.map((voter) => voter.username));
        newVoters.forEach((voter) => {
          if (!votersSet.has(voter.username)) {
            votersSet.add(voter.username);
            voters.push(voter);
          }
        });

        // remove users who changed their vote
        if (attrs.poll.type === "regular") {
          Object.keys(state.voters).forEach((otherOptionId) => {
            if (optionId !== otherOptionId) {
              state.voters[otherOptionId] = state.voters[otherOptionId].filter(
                (voter) => !votersSet.has(voter.username)
              );
            }
          });
        }

        this.scheduleRerender();
      })
      .catch((error) => {
        if (error) {
          popupAjaxError(error);
        } else {
          this.dialog.alert(I18n.t("poll.error_while_fetching_voters"));
        }
      });
  },
});

createWidget("discourse-poll-info", {
  tagName: "div.poll-info",

  multipleHelpText(min, max, options) {
    if (max > 0) {
      if (min === max) {
        if (min > 1) {
          return I18n.t("poll.multiple.help.x_options", { count: min });
        }
      } else if (min > 1) {
        if (max < options) {
          return I18n.t("poll.multiple.help.between_min_and_max_options", {
            min,
            max,
          });
        } else {
          return I18n.t("poll.multiple.help.at_least_min_options", {
            count: min,
          });
        }
      } else if (max <= options) {
        return I18n.t("poll.multiple.help.up_to_max_options", { count: max });
      }
    }
  },

  html(attrs) {
    const { poll, post } = attrs;
    const closed = attrs.isClosed;
    const isStaff = this.currentUser && this.currentUser.staff;
    const isMe = this.currentUser && post.user_id === this.currentUser.id;
    const count = poll.voters;
    const contents = [
      h("div.poll-info_counts-count", [
        h("span.info-number", count.toString()),
        h("span.info-label", I18n.t("poll.voters", { count })),
      ]),
    ];
    const instructions = [];

    if (attrs.isMultiple) {
      if (attrs.showResults || attrs.isClosed) {
        const totalVotes = poll.options.reduce((total, o) => {
          return total + parseInt(o.votes, 10);
        }, 0);

        contents.push(
          h("div.poll-info_counts-count", [
            h("span.info-number", totalVotes.toString()),
            h(
              "span.info-label",
              I18n.t("poll.total_votes", { count: totalVotes })
            ),
          ])
        );
      } else {
        const help = this.multipleHelpText(
          attrs.min,
          attrs.max,
          poll.options.length
        );
        if (help) {
          instructions.push(
            new RawHtml({
              html: `<li>
                      ${iconHTML("list-ul")}
                      <span>${help}</span>
                     </li>`,
            })
          );
        }
      }
    }

    if (poll.close) {
      const closeDate = moment.utc(poll.close, "YYYY-MM-DD HH:mm:ss Z");
      if (closeDate.isValid()) {
        const title = closeDate.format("LLL");
        let label;
        let icon;

        if (attrs.isAutomaticallyClosed) {
          const age = relativeAge(closeDate.toDate(), { addAgo: true });
          label = I18n.t("poll.automatic_close.age", { age });
          icon = "lock";
        } else {
          const timeLeft = moment().to(closeDate, true);
          label = I18n.t("poll.automatic_close.closes_in", { timeLeft });
          icon = "far-clock";
        }

        instructions.push(
          new RawHtml({
            html: `<li title="${title}">
                    ${iconHTML(icon)}
                    <span>${label}</span>
                   </li>`,
          })
        );
      }
    }

    let infoText;
    if (poll.results === "on_vote" && !attrs.hasVoted && !isMe) {
      infoText = new RawHtml({
        html: `<li>
                ${iconHTML("check")}
                <span>${I18n.t("poll.results.vote.title")}</span>
               </li>`,
      });
    } else if (poll.results === "on_close" && !closed) {
      infoText = new RawHtml({
        html: `<li>
                ${iconHTML("lock")}
                <span>${I18n.t("poll.results.closed.title")}</span>
               </li>`,
      });
    } else if (poll.results === "staff_only" && !isStaff) {
      infoText = new RawHtml({
        html: `<li>
                ${iconHTML("shield-alt")}
                <span>${I18n.t("poll.results.staff.title")}</span>
               </li>`,
      });
    }

    if (infoText) {
      instructions.push(infoText);
    }

    if (
      !attrs.isClosed &&
      !attrs.showResults &&
      poll.public &&
      poll.results !== "staff_only"
    ) {
      instructions.push(
        new RawHtml({
          html: `<li>
                  ${iconHTML("far-eye")}
                  <span>${I18n.t("poll.public.title")}</span>
                 </li>`,
        })
      );
    }

    return [
      h("div.poll-info_counts", contents),
      h("ul.poll-info_instructions", instructions),
    ];
  },
});

function clearPieChart(id) {
  let el = document.querySelector(`#poll-results-chart-${id}`);
  el && el.parentNode.removeChild(el);
}

createWidget("discourse-poll-pie-canvas", {
  tagName: "canvas.poll-results-canvas",

  init(attrs) {
    loadScript("/javascripts/Chart.min.js").then(() => {
      const data = attrs.poll.options.mapBy("votes");
      const labels = attrs.poll.options.mapBy("html");
      const config = pieChartConfig(data, labels, {
        legendContainerId: `poll-results-legend-${attrs.id}`,
      });

      const el = document.getElementById(`poll-results-chart-${attrs.id}`);
      // eslint-disable-next-line no-undef
      this._chart = new Chart(el.getContext("2d"), config);
    });
  },

  willRerenderWidget() {
    this._chart?.destroy();
  },

  buildAttributes(attrs) {
    return {
      id: `poll-results-chart-${attrs.id}`,
    };
  },
});

createWidget("discourse-poll-pie-chart", {
  tagName: "div.poll-results-chart",

  html(attrs) {
    const contents = [];

    if (!attrs.showResults) {
      clearPieChart(attrs.id);
      return contents;
    }

    const chart = this.attach("discourse-poll-pie-canvas", attrs);
    contents.push(chart);

    contents.push(h(`ul#poll-results-legend-${attrs.id}.pie-chart-legends`));

    return contents;
  },
});

const htmlLegendPlugin = {
  id: "htmlLegend",

  afterUpdate(chart, args, options) {
    const ul = document.getElementById(options.containerID);
    ul.innerHTML = "";

    const items = chart.options.plugins.legend.labels.generateLabels(chart);
    items.forEach((item) => {
      const li = document.createElement("li");
      li.classList.add("legend");
      li.onclick = () => {
        chart.toggleDataVisibility(item.index);
        chart.update();
      };

      const boxSpan = document.createElement("span");
      boxSpan.classList.add("swatch");
      boxSpan.style.background = item.fillStyle;

      const textContainer = document.createElement("span");
      textContainer.style.color = item.fontColor;
      textContainer.innerHTML = item.text;

      if (!chart.getDataVisibility(item.index)) {
        li.style.opacity = 0.2;
      } else {
        li.style.opacity = 1.0;
      }

      li.appendChild(boxSpan);
      li.appendChild(textContainer);

      ul.appendChild(li);
    });
  },
};

function pieChartConfig(data, labels, opts = {}) {
  const aspectRatio = "aspectRatio" in opts ? opts.aspectRatio : 2.2;
  const strippedLabels = labels.map((l) => stripHtml(l));

  return {
    type: PIE_CHART_TYPE,
    data: {
      datasets: [
        {
          data,
          backgroundColor: getColors(data.length),
        },
      ],
      labels: strippedLabels,
    },
    plugins: [htmlLegendPlugin],
    options: {
      responsive: true,
      aspectRatio,
      animation: { duration: 0 },
      plugins: {
        legend: {
          labels: {
            generateLabels() {
              return labels.map((text, index) => {
                return {
                  fillStyle: getColors(data.length)[index],
                  text,
                  index,
                };
              });
            },
          },
          display: false,
        },
        htmlLegend: {
          containerID: opts?.legendContainerId,
        },
      },
    },
  };
}

function stripHtml(html) {
  let doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

createWidget("discourse-poll-buttons-dropdown", {
  tagName: "div.poll-buttons-dropdown",

  buildId(attrs) {
    return `poll-buttons-dropdown-${attrs.id}`;
  },

  transform(attrs) {
    return {
      content: this._buildContent(attrs),
      onChange: (item) => this.sendWidgetAction(item.id, item.param),
    };
  },

  template: hbs`
  {{attach
    widget="widget-dropdown"
    attrs=(hash
      id=this.attrs.id
      icon="cog"
      label="poll.options.label"
      content=this.transformed.content
      onChange=this.transformed.onChange
      options=this.transformed.options
    )
  }}
`,

  optionsCount(attrs) {
    return this._buildContent(attrs).length;
  },

  _buildContent(attrs) {
    const contents = [];
    const isAdmin = this.currentUser && this.currentUser.admin;
    const dataExplorerEnabled = this.siteSettings.data_explorer_enabled;
    const exportQueryID = this.siteSettings.poll_export_data_explorer_query_id;
    const { poll, post } = attrs;
    const closed = attrs.isClosed;
    const isStaff = this.currentUser && this.currentUser.staff;
    const topicArchived = post.get("topic.archived");

    if (attrs.groupableUserFields.length && poll.voters > 0) {
      const option = { ...buttonOptionsMap.showBreakdown };
      option.id = option.action;
      contents.push(option);
    }

    if (isAdmin && dataExplorerEnabled && poll.voters > 0 && exportQueryID) {
      const option = { ...buttonOptionsMap.exportResults };
      option.id = option.action;
      contents.push(option);
    }

    if (
      this.currentUser &&
      (this.currentUser.id === post.user_id || isStaff) &&
      !topicArchived
    ) {
      if (closed) {
        if (!attrs.isAutomaticallyClosed) {
          const option = { ...buttonOptionsMap.openPoll };
          option.id = option.action;
          contents.push(option);
        }
      } else {
        const option = { ...buttonOptionsMap.closePoll };
        option.id = option.action;
        contents.push(option);
      }
    }

    return contents;
  },
});

createWidget("discourse-poll-buttons", {
  tagName: "div.poll-buttons",

  html(attrs) {
    const contents = [];
    const { poll, post } = attrs;
    const topicArchived = post.get("topic.archived");
    const closed = attrs.isClosed;
    const staffOnly = poll.results === "staff_only";
    const isStaff = this.currentUser && this.currentUser.staff;
    const isMe = this.currentUser && post.user_id === this.currentUser.id;
    const hideResultsDisabled = !staffOnly && (closed || topicArchived);
    const dropdown = this.attach("discourse-poll-buttons-dropdown", attrs);
    const dropdownOptionsCount = dropdown.optionsCount(attrs);

    if (attrs.isMultiple && !hideResultsDisabled && !attrs.showResults) {
      const castVotesDisabled = !attrs.canCastVotes;
      contents.push(
        this.attach("button", {
          className: `cast-votes ${
            castVotesDisabled ? "btn-default" : "btn-primary"
          }`,
          label: "poll.cast-votes.label",
          title: "poll.cast-votes.title",
          icon: castVotesDisabled ? "far-square" : "check",
          disabled: castVotesDisabled,
          action: "castVotes",
        })
      );
    }

    if (attrs.showResults && !hideResultsDisabled) {
      contents.push(
        this.attach("button", {
          className: "btn-default toggle-results",
          label: "poll.hide-results.label",
          title: "poll.hide-results.title",
          icon: "chevron-left",
          action: "toggleResults",
        })
      );
    }

    if (!attrs.showResults && !hideResultsDisabled) {
      let showResultsButton;

      if (
        !(poll.results === "on_vote" && !attrs.hasVoted && !isMe) &&
        !(poll.results === "on_close" && !closed) &&
        !(poll.results === "staff_only" && !isStaff) &&
        poll.voters > 0
      ) {
        showResultsButton = this.attach("button", {
          className: "btn-default toggle-results",
          label: "poll.show-results.label",
          title: "poll.show-results.title",
          icon: "chart-bar",
          action: "toggleResults",
        });
      }

      if (attrs.hasSavedVote) {
        contents.push(
          this.attach("button", {
            className: "btn-default remove-vote",
            label: "poll.remove-vote.label",
            title: "poll.remove-vote.title",
            icon: "undo",
            action: "removeVote",
          })
        );
      }

      if (showResultsButton) {
        contents.push(showResultsButton);
      }
    }

    // only show the dropdown if there's more than 1 button
    // otherwise just show the button
    if (dropdownOptionsCount > 1) {
      contents.push(dropdown);
    } else if (dropdownOptionsCount === 1) {
      const singleOptionId = dropdown._buildContent(attrs)[0].id;
      let singleOption = buttonOptionsMap[singleOptionId];
      if (singleOptionId === "toggleStatus") {
        singleOption = closed
          ? buttonOptionsMap.openPoll
          : buttonOptionsMap.closePoll;
      }
      contents.push(this.attach("button", singleOption));
    }
    return [contents];
  },
});

export default createWidget("discourse-poll", {
  tagName: "div",
  buildKey: (attrs) => `poll-${attrs.id}`,
  services: ["dialog"],

  buildAttributes(attrs) {
    let cssClasses = "poll";
    if (attrs.poll.chart_type === PIE_CHART_TYPE) {
      cssClasses += " pie";
    }
    return {
      class: cssClasses,
      "data-poll-name": attrs.poll.name,
      "data-poll-type": attrs.poll.type,
    };
  },

  defaultState(attrs) {
    const { poll } = attrs;
    const staffOnly = attrs.poll.results === "staff_only";

    const showResults =
      poll.results !== "on_close" && this.hasVoted() && !staffOnly;

    return { loading: false, showResults };
  },

  html(attrs, state) {
    const staffOnly = attrs.poll.results === "staff_only";
    const showResults =
      state.showResults ||
      (attrs.post.get("topic.archived") && !staffOnly) ||
      (this.isClosed() && !staffOnly);

    const newAttrs = {
      ...attrs,
      canCastVotes: this.canCastVotes(),
      hasVoted: this.hasVoted(),
      isAutomaticallyClosed: this.isAutomaticallyClosed(),
      isClosed: this.isClosed(),
      isMultiple: this.isMultiple(),
      max: this.max(),
      min: this.min(),
      showResults,
    };

    return [
      this.attach("discourse-poll-container", newAttrs),
      this.attach("discourse-poll-info", newAttrs),
      this.attach("discourse-poll-buttons", newAttrs),
    ];
  },

  min() {
    let min = parseInt(this.attrs.poll.min, 10);
    if (isNaN(min) || min < 0) {
      min = 1;
    }

    return min;
  },

  max() {
    let max = parseInt(this.attrs.poll.max, 10);
    const numOptions = this.attrs.poll.options.length;
    if (isNaN(max) || max > numOptions) {
      max = numOptions;
    }
    return max;
  },

  isAutomaticallyClosed() {
    const { poll } = this.attrs;
    return (
      poll.close && moment.utc(poll.close, "YYYY-MM-DD HH:mm:ss Z") <= moment()
    );
  },

  isClosed() {
    const { poll } = this.attrs;
    return poll.status === "closed" || this.isAutomaticallyClosed();
  },

  isMultiple() {
    const { poll } = this.attrs;
    return poll.type === "multiple";
  },

  hasVoted() {
    const { vote } = this.attrs;
    return vote && vote.length > 0;
  },

  canCastVotes() {
    const { state, attrs } = this;

    if (this.isClosed() || state.showResults || state.loading) {
      return false;
    }

    const selectedOptionCount = attrs.vote.length;

    if (this.isMultiple()) {
      return (
        selectedOptionCount >= this.min() && selectedOptionCount <= this.max()
      );
    }

    return selectedOptionCount > 0;
  },

  toggleStatus() {
    const { state, attrs } = this;
    const { post, poll } = attrs;

    if (this.isAutomaticallyClosed()) {
      return;
    }

    this.dialog.yesNoConfirm({
      message: I18n.t(
        this.isClosed() ? "poll.open.confirm" : "poll.close.confirm"
      ),
      didConfirm: () => {
        state.loading = true;
        const status = this.isClosed() ? "open" : "closed";
        ajax("/polls/toggle_status", {
          type: "PUT",
          data: {
            post_id: post.id,
            poll_name: poll.name,
            status,
          },
        })
          .then(() => {
            poll.set("status", status);
            if (poll.results === "on_close") {
              state.showResults = status === "closed";
            }
            this.scheduleRerender();
          })
          .catch((error) => {
            if (error) {
              popupAjaxError(error);
            } else {
              this.dialog.alert(I18n.t("poll.error_while_toggling_status"));
            }
          })
          .finally(() => {
            state.loading = false;
          });
      },
    });
  },

  toggleResults() {
    this.state.showResults = !this.state.showResults;
  },

  removeVote() {
    const { attrs, state } = this;
    state.loading = true;
    return ajax("/polls/vote", {
      type: "DELETE",
      data: {
        post_id: attrs.post.id,
        poll_name: attrs.poll.name,
      },
    })
      .then(({ poll }) => {
        attrs.poll.setProperties(poll);
        attrs.vote.length = 0;
        attrs.hasSavedVote = false;
        this.appEvents.trigger("poll:voted", poll, attrs.post, attrs.vote);
      })
      .catch((error) => popupAjaxError(error))
      .finally(() => {
        state.loading = false;
      });
  },

  exportResults() {
    const { attrs } = this;
    const queryID = this.siteSettings.poll_export_data_explorer_query_id;

    // This uses the Data Explorer plugin export as CSV route
    // There is detection to check if the plugin is enabled before showing the button
    ajax(`/admin/plugins/explorer/queries/${queryID}/run.csv`, {
      type: "POST",
      data: {
        // needed for data-explorer route compatibility
        params: JSON.stringify({
          poll_name: attrs.poll.name,
          post_id: attrs.post.id.toString(), // needed for data-explorer route compatibility
        }),
        explain: false,
        limit: 1000000,
        download: 1,
      },
    })
      .then((csvContent) => {
        const downloadLink = document.createElement("a");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.setAttribute(
          "download",
          `poll-export-${attrs.poll.name}-${attrs.post.id}.csv`
        );
        downloadLink.click();
        downloadLink.remove();
      })
      .catch((error) => {
        if (error) {
          popupAjaxError(error);
        } else {
          this.dialog.alert(I18n.t("poll.error_while_exporting_results"));
        }
      });
  },

  showLogin() {
    this.register.lookup("route:application").send("showLogin");
  },

  _toggleOption(option) {
    const { vote } = this.attrs;
    const chosenIdx = vote.indexOf(option.id);
    if (chosenIdx !== -1) {
      vote.splice(chosenIdx, 1);
    } else {
      vote.push(option.id);
    }
  },

  toggleOption(option) {
    const { attrs } = this;

    if (this.isClosed()) {
      return;
    }
    if (!this.currentUser) {
      return this.showLogin();
    }
    if (!checkUserGroups(this.currentUser, this.attrs.poll)) {
      return;
    }

    const { vote } = attrs;
    if (!this.isMultiple() && vote.length === 1 && vote[0] === option.id) {
      return this.removeVote();
    }

    if (!this.isMultiple()) {
      vote.length = 0;
    }

    this._toggleOption(option);
    if (!this.isMultiple()) {
      return this.castVotes().catch(() => this._toggleOption(option));
    }
  },

  castVotes() {
    if (!this.canCastVotes()) {
      return;
    }
    if (!this.currentUser) {
      return this.showLogin();
    }

    const { attrs, state } = this;

    state.loading = true;

    return ajax("/polls/vote", {
      type: "PUT",
      data: {
        post_id: attrs.post.id,
        poll_name: attrs.poll.name,
        options: attrs.vote,
      },
    })
      .then(({ poll }) => {
        attrs.hasSavedVote = true;
        attrs.poll.setProperties(poll);
        this.appEvents.trigger("poll:voted", poll, attrs.post, attrs.vote);

        if (attrs.poll.results !== "on_close") {
          state.showResults = true;
        }
        if (attrs.poll.results === "staff_only") {
          if (this.currentUser && this.currentUser.staff) {
            state.showResults = true;
          } else {
            state.showResults = false;
          }
        }
      })
      .catch((error) => {
        if (error) {
          popupAjaxError(error);
        } else {
          this.dialog.alert(I18n.t("poll.error_while_casting_votes"));
        }
      })
      .finally(() => {
        state.loading = false;
      });
  },

  showBreakdown() {
    getOwner(this).lookup("service:modal").show(PollBreakdownModal, {
      model: this.attrs,
    });
  },
});
