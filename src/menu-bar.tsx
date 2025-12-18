import {
  Clipboard,
  Color,
  Icon,
  launchCommand,
  LaunchType,
  MenuBarExtra,
  open,
  openCommandPreferences,
  showHUD,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useSessions } from "./jules";
import { useSessionNotifications } from "./notification";
import { Session } from "./types";
import { formatPrSubtitle, formatPrTitle, getStatusIconSimpleForSession, groupSessions } from "./utils";

function AlternateSessionMenuBarItem({ session }: { session: Session }) {
  const prUrl = session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

  if (!prUrl) {
    return null;
  }

  return (
    <MenuBarExtra.Item
      key={`${session.id}-pr`}
      icon={{ source: "git-pull-request-arrow.svg", tintColor: Color.PrimaryText }}
      title={formatPrTitle(prUrl)}
      subtitle={formatPrSubtitle(prUrl)}
      onAction={async (event) => {
        switch (event.type) {
          case "left-click":
            await open(prUrl);
            break;
          case "right-click":
            await Clipboard.copy(prUrl);
            await showHUD("Copied PR URL to clipboard");
            break;
        }
      }}
    />
  );
}

function SessionMenuBarItem({ session }: { session: Session }) {
  return (
    <MenuBarExtra.Item
      key={session.id}
      icon={getStatusIconSimpleForSession(session)}
      title={session.title || session.id}
      tooltip={session.prompt}
      alternate={<AlternateSessionMenuBarItem session={session} />}
      onAction={async (event) => {
        switch (event.type) {
          case "left-click":
            await open(session.url);
            break;
          case "right-click":
            await Clipboard.copy(session.url);
            await showHUD("Copied URL to clipboard");
            break;
        }
      }}
    />
  );
}

export default function MenuBar() {
  const { data, isLoading } = useSessions();
  const { titleCount, statusIcon } = useSessionNotifications(data);

  const { today, yesterday, thisWeek } = groupSessions(data);

  return (
    <MenuBarExtra icon={statusIcon} title={titleCount} isLoading={isLoading}>
      {today.length > 0 && (
        <MenuBarExtra.Section title="Today">
          {today.map((session) => (
            <SessionMenuBarItem key={session.id} session={session} />
          ))}
        </MenuBarExtra.Section>
      )}

      {yesterday.length > 0 && (
        <MenuBarExtra.Section title="Yesterday">
          {yesterday.map((session) => (
            <SessionMenuBarItem key={session.id} session={session} />
          ))}
        </MenuBarExtra.Section>
      )}

      {thisWeek.length > 0 && (
        <MenuBarExtra.Section title="This Week">
          {thisWeek.map((session) => (
            <SessionMenuBarItem key={session.id} session={session} />
          ))}
        </MenuBarExtra.Section>
      )}

      {today.length === 0 && yesterday.length === 0 && thisWeek.length === 0 && !isLoading && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="No recent sessions" />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          icon={{ source: "icon.svg", tintColor: Color.PrimaryText }}
          title="View All Sessions"
          onAction={async () => {
            try {
              await launchCommand({ name: "list-sessions", type: LaunchType.UserInitiated });
            } catch (e) {
              showFailureToast(e, { title: "Failed to launch list sessions command" });
            }
          }}
        />
        <MenuBarExtra.Item
          icon={Icon.Globe}
          title="Open Dashboard"
          onAction={() => open("https://jules.google.com/sessions")}
        />
        <MenuBarExtra.Item icon={Icon.Gear} title="Configure Command" onAction={openCommandPreferences} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
