import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TitleBar, SecHero, EmptyState, TYPE } from '@/app/components/ui';

const ACTION_LABELS: Record<string, string> = {
  geo_checkin: 'Checked in at a store',
  store_checkin: 'Store check-in',
  store_event_attendance: 'Attended a store event',
  tournament_result: 'Tournament result',
  game_night_rsvp: 'RSVP to a game night',
  purchase: 'Purchase',
};

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const activities = await prisma.userActivity.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, action: true, targetType: true, metadata: true, createdAt: true },
  });

  return (
    <>
      <TitleBar left="History" right={`${activities.length} ${activities.length === 1 ? 'event' : 'events'}`} />
      <SecHero
        fieldNum="05"
        fieldType="Record"
        title="History"
        desc="Check-ins, events, tournaments, and activity across the Afterroar network."
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body }}>
        {activities.length === 0 ? (
          <EmptyState
            title="No activity yet"
            desc="Check-ins, event attendance, and tournament results will appear here as you participate across the Afterroar network."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
            {activities.map((activity) => {
              let meta: Record<string, unknown> = {};
              try { meta = activity.metadata ? JSON.parse(activity.metadata) : {}; } catch { /* ignore */ }

              return (
                <div key={activity.id} style={{
                  padding: '0.9rem 1rem',
                  background: 'var(--panel-mute)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.body, color: 'var(--cream)', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                      {ACTION_LABELS[activity.action] || activity.action}
                    </p>
                    {typeof meta.venueName === 'string' ? (
                      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.2rem 0 0', fontSize: '0.8rem' }}>at {meta.venueName}</p>
                    ) : null}
                    {typeof meta.eventName === 'string' ? (
                      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.2rem 0 0', fontSize: '0.8rem' }}>{meta.eventName}</p>
                    ) : null}
                    {meta.record && typeof meta.record === 'object' ? (
                      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                        Record: {(meta.record as { wins: number }).wins}W-{(meta.record as { losses: number }).losses}L
                      </p>
                    ) : null}
                  </div>
                  <span style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.7rem', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {activity.createdAt.toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
