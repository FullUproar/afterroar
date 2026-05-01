import { requireAdmin } from '@/lib/admin-auth';
import { ChromeNav, Workbench, PlayerCard } from '@/app/components/card-shell';
import { TitleBar } from '@/app/components/ui';
import NewUserForm from './NewUserForm';

export default async function NewUserPage() {
  const session = await requireAdmin();
  return (
    <>
      <ChromeNav signedIn email={session.user?.email} />
      <Workbench>
        <PlayerCard maxWidth="32rem">
          <TitleBar left="Admin · New User" />
          <div style={{ padding: '1.5rem var(--pad-x) 1.5rem' }}>
            <NewUserForm />
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
