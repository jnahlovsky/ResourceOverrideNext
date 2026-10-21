// The card that edits each kind of rule; used by the editor (App.vue) and the open rows of
// the popup / side panel (SidePanel.vue, as "bare" cards).
import RedirectRule from './RedirectRule.vue';
import QueryRule from './QueryRule.vue';
import HeaderRule from './HeaderRule.vue';
import MockRule from './MockRule.vue';
import FileOverrideRule from './FileOverrideRule.vue';
import BlockRule from './BlockRule.vue';
import FileInjectRule from './FileInjectRule.vue';

export const RULE_EDITORS = {
  normalOverride: RedirectRule,
  queryRule: QueryRule,
  headerRule: HeaderRule,
  mockRule: MockRule,
  fileOverride: FileOverrideRule,
  blockRule: BlockRule,
  fileInject: FileInjectRule
};
