import { Action, ActionPanel, Detail, Keyboard } from "@raycast/api";
import { ChangeSet } from "../types";

export function CodeReviewView(props: { changeSet: ChangeSet }) {
  const { changeSet } = props;
  const patch = changeSet.gitPatch?.unidiffPatch;
  const commitMessage = changeSet.gitPatch?.suggestedCommitMessage;
  const baseCommitId = changeSet.gitPatch?.baseCommitId;

  const markdown = "```diff\n" + patch + "\n```";

  return (
    <Detail
      markdown={markdown}
      navigationTitle={commitMessage ? `Code Review: ${commitMessage}` : "Code Review"}
      actions={
        <ActionPanel>
          {patch && (
            <Action.CopyToClipboard
              title="Copy Patch"
              content={patch}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          )}
          {commitMessage && (
            <Action.CopyToClipboard title="Copy Commit Message" content={commitMessage} />
          )}
          {baseCommitId && (
            <Action.CopyToClipboard title="Copy Base Commit ID" content={baseCommitId} />
          )}
        </ActionPanel>
      }
    />
  );
}

