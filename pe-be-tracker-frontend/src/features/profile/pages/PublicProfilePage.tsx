import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Dumbbell, ListChecks } from "lucide-react";

import { getPublicActivities, getPublicProfile } from "@/features/profile/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";

const formatDateValue = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatProfileDate = (value?: string | null) =>
  value
    ? formatDateValue(value)
    : "No activity yet";

const formatActivityDate = (value?: string | null) =>
  value ? formatDateValue(value) : "—";

const PublicProfilePage = () => {
  const { username = "" } = useParams();

  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => getPublicProfile(username),
    enabled: Boolean(username),
  });

  const activitiesQuery = useQuery({
    queryKey: ["public-profile-activities", username],
    queryFn: () => getPublicActivities(username, undefined, 20),
    enabled: Boolean(username),
  });

  if (profileQuery.isPending) {
    return <div className="mx-auto max-w-4xl px-4 py-8">Loading profile...</div>;
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Profile unavailable</AlertTitle>
          <AlertDescription>
            This public profile does not exist or is not currently visible.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const profile = profileQuery.data;
  const activities = activitiesQuery.data?.data ?? [];

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-left">
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-xl font-black text-primary">
              {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-black tracking-tight">
              {profile.display_name || `@${profile.username}`}
            </h1>
            <p className="text-sm font-bold text-muted-foreground">@{profile.username}</p>
            {profile.bio ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-black">{profile.public_workout_count}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Public workouts
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-black">
                {formatProfileDate(profile.last_public_activity_at)}
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Latest activity
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black tracking-tight">Recent activity</h2>
        {activitiesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public workouts yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Link
                key={activity.id}
                to={`/u/${profile.username}/activities/${activity.id}`}
                className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black">
                      {activity.name || activity.workout_type.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatActivityDate(activity.end_time)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activity.exercise_names_preview.join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm font-bold text-muted-foreground">
                    <ListChecks className="h-4 w-4" />
                    {activity.exercise_count} / {activity.set_count}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/workouts">Back to workouts</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default PublicProfilePage;
