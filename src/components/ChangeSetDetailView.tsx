import { Action, ActionPanel, Detail, Keyboard } from "@raycast/api";
import { ChangeSet } from "../types";

export function ChangeSetDetailView(props: { changeSet: ChangeSet }) {
  const { changeSet } = props;
  const patch = changeSet.gitPatch?.unidiffPatch || "";
  const commitMessage = changeSet.gitPatch?.suggestedCommitMessage || "";
  const baseCommitId = changeSet.gitPatch?.baseCommitId || "N/A";

  return (
    <Detail
      navigationTitle="Change Set Details"
      markdown={`\`\`\`diff\n${patch}\n\`\`\``}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Source" text={changeSet.source} />
          <Detail.Metadata.Label title="Base Commit ID" text={baseCommitId} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Suggested Commit Message" />
          <Detail.Metadata.Label title="" text={commitMessage} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Patch"
            content={patch}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action.CopyToClipboard title="Copy Commit Message" content={commitMessage} />
        </ActionPanel>
      }
    />
  );
}
