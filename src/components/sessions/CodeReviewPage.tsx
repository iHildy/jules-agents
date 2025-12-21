import { Action, ActionPanel, Color, Detail, Icon } from "@raycast/api";
import { useSessionActivities } from "../../jules";
import { Session } from "../../types";
import { FileChange, parseUnidiffToFiles } from "../../utils";
import { FileDetailView } from "./FileDetailView";

function ApprovePrAction(props: { prUrl: string }) {
  return (
    <Action.CopyToClipboard
      title="Copy Approve Command"
      icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
      content={`gh pr review --approve ${props.prUrl}`}
      shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
    />
  );
}

function MergePrAction(props: { prUrl: string }) {
  return (
    <Action.CopyToClipboard
      title="Copy Merge Command"
      icon={{ source: Icon.ArrowRight, tintColor: Color.Purple }}
      content={`gh pr merge --squash ${props.prUrl}`}
    />
  );
}

export function CodeReviewPage(props: { session: Session }) {
  const { data: activities, isLoading } = useSessionActivities(props.session.name);
  const prUrl = props.session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  const allChanges: FileChange[] = [];
  const seenFiles = new Set<string>();

  activities?.forEach((activity) => {
    activity.artifacts?.forEach((artifact) => {
      if (artifact.changeSet?.gitPatch) {
        const files = parseUnidiffToFiles(
          artifact.changeSet.gitPatch.unidiffPatch,
          artifact.changeSet.source,
          artifact.changeSet.gitPatch.suggestedCommitMessage,
        );
        files.forEach((file) => {
          if (!seenFiles.has(file.filename)) {
            seenFiles.add(file.filename);
            allChanges.push(file);
          }
        });
      }
    });
  });

  // Sort alphabetically by path (like GitHub PR review)
  allChanges.sort((a, b) => a.filename.localeCompare(b.filename));

  const fullDiff = allChanges.map((c) => c.patch).join("\n\n");
  const commitMessage = allChanges.find((c) => c.commitMessage)?.commitMessage;

  // Build markdown with all diffs
  let markdown = "";
  if (commitMessage) {
    markdown += `## Suggested Commit Message\n\n${commitMessage}\n\n---\n\n`;
  }
  markdown += `## ${allChanges.length} Files Changed\n\n`;
  allChanges.forEach((change) => {
    const lineCount = change.displayPatch.split("\n").length;
    const hunksDisplay = change.hunks.length > 0 ? ` · ${change.hunks.join(" ")}` : "";
    markdown += `### ${change.filename} [${lineCount} lines]${hunksDisplay}\n\n\`\`\`diff\n${change.displayPatch}\n\`\`\`\n\n`;
  });

  if (isLoading) {
    return <Detail isLoading navigationTitle={`Code Review: ${props.session.title || props.session.id}`} />;
  }

  if (allChanges.length === 0) {
    return (
      <Detail
        navigationTitle={`Code Review: ${props.session.title || props.session.id}`}
        markdown="# No Code Changes\n\nThis session has no code changes to review."
        actions={
          <ActionPanel>
            <Action.OpenInBrowser url={props.session.url} title="Open Session in Browser" />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Detail
      navigationTitle={`Code Review: ${props.session.title || props.session.id}`}
      markdown={markdown}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy All Changes" content={fullDiff} />
            {commitMessage && <Action.CopyToClipboard title="Copy Commit Message" content={commitMessage} />}
          </ActionPanel.Section>
          <ActionPanel.Section title={`Files (${allChanges.length})`}>
            {allChanges.map((file, index) => (
              <Action.Push
                key={`${file.filename}-${index}`}
                title={file.filename}
                icon={Icon.Document}
                target={<FileDetailView file={file} session={props.session} />}
              />
            ))}
          </ActionPanel.Section>
          {prUrl && (
            <ActionPanel.Section title="Pull Request">
              <ApprovePrAction prUrl={prUrl} />
              <MergePrAction prUrl={prUrl} />
              <Action.OpenInBrowser
                icon={{ source: "git-pull-request-arrow.svg", tintColor: Color.PrimaryText }}
                url={prUrl}
                title="Open Pull Request"
              />
            </ActionPanel.Section>
          )}
          <ActionPanel.Section>
            <Action.OpenInBrowser url={props.session.url} title="Open Session in Browser" />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
