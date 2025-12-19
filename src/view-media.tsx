
import { Action, ActionPanel, Grid, Icon, showToast, Toast } from "@raycast/api";
import { useSessionActivities } from "./jules";
import { Session, Media } from "./types";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const mimeTypeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function getExtensionFromMimeType(mimeType: string): string {
  return mimeTypeToExtension[mimeType] || mimeType.split("/")[1]?.split("+")[0] || "bin";
}

async function saveMediaToDownloads(media: Media, session: Session): Promise<string> {
  const downloadsPath = join(homedir(), "Downloads");
  await mkdir(downloadsPath, { recursive: true });

  const extension = getExtensionFromMimeType(media.mimeType);
  const filename = `${session.id}-${Date.now()}.${extension}`;
  const filepath = join(downloadsPath, filename);

  await writeFile(filepath, media.data, "base64");
  return filepath;
}

export default function ViewMedia(props: { session: Session }) {
  const { data: activities, isLoading } = useSessionActivities(props.session.name);

  const mediaArtifacts: Media[] =
    activities
      ?.flatMap((activity) => activity.artifacts ?? [])
      .map((artifact) => artifact.media)
      .filter((media): media is Media => !!media) ?? [];

  if (!isLoading && mediaArtifacts.length === 0) {
    return <Grid.EmptyView title="No Media Found" description="This session has no media artifacts." />;
  }

  return (
    <Grid isLoading={isLoading} navigationTitle="Media Artifacts">
      {mediaArtifacts.map((media, index) => (
        <Grid.Item
          key={index}
          content={{ source: `data:${media.mimeType};base64,${media.data}` }}
          title={`Artifact ${index + 1}`}
          actions={
            <ActionPanel>
              <Action
                title="Save to Downloads"
                icon={Icon.Download}
                onAction={async () => {
                  const toast = await showToast({
                    style: Toast.Style.Animated,
                    title: "Saving media to downloads...",
                  });
                  try {
                    const savedPath = await saveMediaToDownloads(media, props.session);
                    toast.style = Toast.Style.Success;
                    toast.title = "Media saved to downloads";
                    toast.message = savedPath;
                  } catch (error) {
                    toast.style = Toast.Style.Failure;
                    toast.title = "Failed to save media";
                    toast.message = error instanceof Error ? error.message : String(error);
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
