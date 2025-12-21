import { Action, ActionPanel, Detail } from "@raycast/api";
import { Session } from "../../types";
import { FileChange } from "../../utils";

export function FileDetailView(props: { file: FileChange; session: Session }) {
  const lineCount = props.file.displayPatch.split("\n").length;
  const hunksDisplay = props.file.hunks.length > 0 ? ` · ${props.file.hunks.join(" ")}` : "";
  return (
    <Detail
      navigationTitle={props.file.filename}
      markdown={`# ${props.file.filename} [${lineCount} lines]${hunksDisplay}\n\n\`\`\`diff\n${props.file.displayPatch}\n\`\`\``}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy File Diff" content={props.file.patch} />
          {props.file.gitDiffCommand && (
            <Action.CopyToClipboard title="Copy Git Diff Command" content={props.file.gitDiffCommand} />
          )}
          <Action.OpenInBrowser url={props.session.url} title="Open Session in Browser" />
        </ActionPanel>
      }
    />
  );
}
