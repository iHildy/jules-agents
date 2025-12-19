import { Action, ActionPanel, Detail, Keyboard } from "@raycast/api";
import { ChangeSet } from "../types";

export function ChangeSetDetailView(props: { changeSet: ChangeSet }) {
  const { changeSet } = props;
  const patch = changeSet.gitPatch?.unidiffPatch;
  const commitMessage = changeSet.gitPatch?.suggestedCommitMessage;
  const baseCommitId = changeSet.gitPatch?.baseCommitId;

  const markdown = "```diff\n" + patch + "\n```";

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Change Set"
      metadata={
        <Detail.Metadata>
          {baseCommitId && <Detail.Metadata.Label title="Base Commit ID" text={baseCommitId} />}
          {commitMessage && <Detail.Metadata.Label title="Suggested Commit Message" text={commitMessage} />}
        </Detail.Metadata>
      }
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
            <Action.CopyToClipboard
              title="Copy Commit Message"
              content={commitMessage}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
