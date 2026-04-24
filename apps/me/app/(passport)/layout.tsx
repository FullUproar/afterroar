import { auth } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import { ChromeNav, Workbench, PlayerCard, CardFoot } from '@/app/components/card-shell';

export default async function PassportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return (
    <>
      <ChromeNav email={session.user.email} />
      <Workbench>
        <PlayerCard>
          {children}
          <CardFoot />
        </PlayerCard>
      </Workbench>
    </>
  );
}
