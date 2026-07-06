export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/topbar';
import { listEditableProfiles } from '@/domain/profiles/repository';
import { listProjectsByAccount } from '@/domain/projects/repository';

import { ProfileWorkbench } from './profile-workbench';

type Props = {
  searchParams?: Promise<{ profileId?: string }>;
};

export default async function ProfilesPage({ searchParams }: Props) {
  const [sp, profiles, projectsByAccount] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    listEditableProfiles(),
    listProjectsByAccount(),
  ]);
  const profileId = (sp as { profileId?: string }).profileId ?? null;
  const selectedProfile = profiles.find((p) => p.account.id === profileId) ?? null;

  return (
    <div className="space-y-6">
      <Topbar
        title="Profiles"
        subtitle="Manage Gmail routing, qualification thresholds, and proposal guidance for each Upwork profile."
      />
      <ProfileWorkbench profiles={profiles} selectedProfile={selectedProfile} projectsByAccount={projectsByAccount} />
    </div>
  );
}
